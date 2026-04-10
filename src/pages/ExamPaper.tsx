import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertCircle, ChevronRight, Lightbulb, Clock, MessageSquare, Loader2 } from 'lucide-react';
import { store } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { Exam, Assignment, Attempt, Student, Class, ExamVersion } from '@/types';
import { RichTextDisplay } from '@/components/RichTextDisplay';
import { calculateLegacyExamScore } from '@/lib/examScoring';
import { getExamAvailability, getExamDurationInSeconds } from '@/lib/examValidation';
import { mapVersionAnswersToOriginal, pickDeterministicExamVersion } from '@/lib/examVersioning';
import 'react-quill-new/dist/quill.snow.css';

interface ExamPaperProps {
  mode: 'EXAM' | 'PRACTICE' | 'REVIEW';
}

export default function ExamPaper({ mode = 'EXAM' }: ExamPaperProps) {
  const navigate = useNavigate();
  const { id: assignmentId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();
  
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [sourceExam, setSourceExam] = useState<Exam | null>(null);
  const [examVersion, setExamVersion] = useState<ExamVersion | null>(null);
  const [availableVersionsState, setAvailableVersionsState] = useState<ExamVersion[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const [answersPart1, setAnswersPart1] = useState<Record<number, string>>({});
  const [answersPart2, setAnswersPart2] = useState<Record<number, Record<string, boolean>>>({});
  const [answersPart3, setAnswersPart3] = useState<Record<number, string>>({});
  
  // Timer states
  const [timeLeft, setTimeLeft] = useState<number>(50 * 60); // 50 minutes
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // Anti-cheat states
  const [isFullscreenStarted, setIsFullscreenStarted] = useState(mode !== 'EXAM');
  const [cheatWarning, setCheatWarning] = useState<string | null>(null);

  // Practice mode states
  const [currentQuestion, setCurrentQuestion] = useState<{part: number, num: number, sub?: string} | null>(
    mode === 'PRACTICE' ? {part: 1, num: 1} : null
  );
  const [practiceFeedback, setPracticeFeedback] = useState<'CORRECT' | 'WRONG_1' | 'WRONG_2' | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState<number>(0);
  const [reflectionText, setReflectionText] = useState<string>('');
  const [alertDialog, setAlertDialog] = useState<{isOpen: boolean, message: string, onClose: () => void}>({isOpen: false, message: '', onClose: () => {}});

  const [reviewTab, setReviewTab] = useState<'STUDENT_WORK' | 'ANSWER_KEY'>('STUDENT_WORK');
  const [bestAttempt, setBestAttempt] = useState<Attempt | null>(null);

  // AI Tutor states
  const [activeAITutor, setActiveAITutor] = useState<{part: number, num: number, sub?: string} | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const examVersionDigits = (examVersion?.code || '')
    .toString()
    .padStart(4, ' ')
    .slice(-4)
    .split('')
    .map((ch) => (ch === ' ' ? '' : ch));

  // Helper to strip HTML tags for AI prompt
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const handleAiHelp = (part: number, num: number, sub?: string) => {
    setActiveAITutor({ part, num, sub });
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsPageLoading(true);

      try {
        let resolvedStudent: Student | null = null;

        if (userProfile && userProfile.role === 'STUDENT') {
          const students = await store.getStudents();
          const student = students.find(s => s.id === userProfile.uid);
          if (student) {
            if (!isMounted) return;
            setLoggedInStudent(student);
            resolvedStudent = student;
          } else {
            if (!isMounted) return;
            setAlertDialog({
              isOpen: true,
              message: 'Không tìm thấy thông tin học sinh!',
              onClose: () => navigate('/student')
            });
            return;
          }
        } else {
          if (!isMounted) return;
          setAlertDialog({
            isOpen: true,
            message: 'Vui lòng đăng nhập để làm bài!',
            onClose: () => navigate('/auth')
          });
          return;
        }

        if (!assignmentId) {
          if (!isMounted) return;
          setAlertDialog({
            isOpen: true,
            message: 'Không tìm thấy mã bài luyện/đề thi.',
            onClose: () => navigate('/student')
          });
          return;
        }

        let resolvedAssignment = await store.getAssignmentById(assignmentId);
        let resolvedExam: Exam | undefined;

        if (!resolvedAssignment && mode === 'PRACTICE') {
          resolvedExam = await store.getExamById(assignmentId);
          if (resolvedExam && resolvedStudent) {
            resolvedAssignment = {
              id: `practice-${resolvedExam.id}`,
              examId: resolvedExam.id,
              classId: resolvedStudent.classId,
              teacherId: resolvedExam.teacherId,
              mode: 'PRACTICE',
              status: 'IN_PROGRESS',
              dueDate: '2099-12-31T23:59',
              maxAttempts: 999,
              titleSnapshot: resolvedExam.title,
              subjectSnapshot: resolvedExam.subject,
              durationMinutesSnapshot: resolvedExam.onlineSettings?.durationMinutes,
              createdAt: resolvedExam.createdAt,
            };
          }
        }

        if (!resolvedAssignment) {
          if (!isMounted) return;
          setAlertDialog({
            isOpen: true,
            message: 'Không tìm thấy bài được giao để luyện thi.',
            onClose: () => navigate('/student')
          });
          return;
        }

        if (!isMounted) return;
        setAssignment(resolvedAssignment);

        resolvedExam = resolvedExam || await store.getExamById(resolvedAssignment.examId);
        if (!resolvedExam) {
          setAlertDialog({
            isOpen: true,
            message: 'Không tìm thấy đề thi hoặc đề đã bị xóa/khóa.',
            onClose: () => navigate('/student')
          });
          return;
        }

        setSourceExam(resolvedExam);
        if (resolvedExam.templateType === 'LEGACY_PHIU_TRA_LOI' && mode !== 'EXAM' && mode !== 'REVIEW') {
          setIsFullscreenStarted(false);
        }

        const availability = getExamAvailability(resolvedExam, resolvedAssignment);
        if (mode !== 'REVIEW' && !availability.allowed) {
          setAlertDialog({
            isOpen: true,
            message: availability.reason,
            onClose: () => navigate('/student')
          });
          return;
        }

        if (mode !== 'REVIEW') {
          const duration = getExamDurationInSeconds(resolvedExam);
          setTimeLeft(duration);
        }

        // Load tất cả các mã đề có sẵn (cho cả EXAM lẫn PRACTICE với phiếu in giấy)
        const availableVersions = await store.getExamVersions(resolvedAssignment.examId);
        setAvailableVersionsState(availableVersions);
        let selectedVersion: ExamVersion | null = null;

        if (mode === 'EXAM' && resolvedAssignment.mode === 'EXAM' && userProfile?.uid) {
          const studentAttempts = await store.getAttempts(userProfile.uid, resolvedAssignment.id);
          if (studentAttempts.length >= (resolvedAssignment.maxAttempts || 1)) {
            setAlertDialog({
              isOpen: true,
              message: `Em đã hết số lần làm bài cho phép (${resolvedAssignment.maxAttempts || 1} lần).`,
              onClose: () => navigate('/student')
            });
            return;
          }
        }

        if (mode === 'EXAM' && userProfile?.uid && resolvedStudent) {
          const existingDraft = await store.getAttemptDraft(resolvedAssignment.id, userProfile.uid);
          if (existingDraft?.examVersionId) {
            selectedVersion = availableVersions.find((version) => version.id === existingDraft.examVersionId) || null;
          }

          // Cập nhật: CHỈ gán mã đề random nếu là thi ONLINE. Nếu là phiếu in giấy (LEGACY), học sinh PHẢI tự chọn mã đề thực tế của mình.
          if (!selectedVersion && availableVersions.length > 0 && resolvedExam.templateType !== 'LEGACY_PHIU_TRA_LOI') {
            selectedVersion = pickDeterministicExamVersion(availableVersions, userProfile.uid, resolvedAssignment.id);
          }

          // Khôi phục nháp (của bài cũ)
          if (existingDraft) {
            setAnswersPart1(existingDraft.answersPart1 || {});
            setAnswersPart2(existingDraft.answersPart2 || {});
            setAnswersPart3(existingDraft.answersPart3 || {});
            setStartedAt(existingDraft.startedAt || Date.now());
            setTabSwitchCount(existingDraft.tabSwitchCount || 0);
            const fullDuration = getExamDurationInSeconds(resolvedExam);
            const elapsedSeconds = Math.floor((Date.now() - (existingDraft.startedAt || Date.now())) / 1000);
            setTimeLeft(Math.max(0, fullDuration - elapsedSeconds));
            setDraftRestored(true);
            setLastSavedAt(existingDraft.updatedAt || Date.now());
          } else {
            const now = Date.now();
            setStartedAt(now);
            setDraftRestored(true);
          }
        }

        // PRACTICE mode: cũng tương tự, CHỈ gán random nếu là ONLINE. LEGACY thì học sinh tự chọn.
        if (mode === 'PRACTICE' && userProfile?.uid && availableVersions.length > 0 && resolvedExam.templateType !== 'LEGACY_PHIU_TRA_LOI') {
          selectedVersion = pickDeterministicExamVersion(availableVersions, userProfile.uid, resolvedAssignment.id);
        }

        if (mode === 'REVIEW' && userProfile?.uid) {
          const studentAttempts = await store.getAttempts(userProfile.uid, resolvedAssignment.id);
          if (studentAttempts.length > 0) {
            const best = studentAttempts.reduce((prev, current) => (prev.score > current.score) ? prev : current);
            setBestAttempt(best);
            setAnswersPart1(best.answersPart1 || {});
            setAnswersPart2(best.answersPart2 || {});
            setAnswersPart3(best.answersPart3 || {});
            if (best.examVersionId) {
              selectedVersion = availableVersions.find((version) => version.id === best.examVersionId) || null;
            }
          } else {
            setAlertDialog({
              isOpen: true,
              message: 'Không tìm thấy bài làm nào để xem lại.',
              onClose: () => navigate('/student')
            });
            return;
          }
        }

        setExamVersion(selectedVersion);
        setExam(selectedVersion?.derivedExam || resolvedExam);

        const loadedClasses = await store.getClasses();
        if (!isMounted) return;
        setClasses(loadedClasses);
      } catch (err: any) {
        console.error("Error loading exam data:", err);
        if (isMounted) {
          setAlertDialog({
            isOpen: true,
            message: `Có lỗi kỹ thuật khi tải đề thi: ${err?.message || 'Vui lòng thử lại sau.'}`,
            onClose: () => navigate('/student')
          });
        }
      } finally {
        if (isMounted) {
          setIsPageLoading(false);
        }
      }
    };

    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [assignmentId, navigate, userProfile, mode]);

  const isEnforcedExamMode = mode === 'EXAM' || (sourceExam?.templateType === 'LEGACY_PHIU_TRA_LOI' && mode !== 'REVIEW');
  const isAntiCheatEnabled = isEnforcedExamMode && sourceExam?.templateType !== 'LEGACY_PHIU_TRA_LOI';

  useEffect(() => {
    if (!isAntiCheatEnabled || !isFullscreenStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const next = prev + 1;
          setCheatWarning(`CẢNH BÁO: Em vừa rời khỏi giao diện làm bài (chuyển tab hoặc ẩn trình duyệt)! Số lần vi phạm: ${next}`);
          return next;
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setTabSwitchCount(prev => {
          const next = prev + 1;
          setCheatWarning(`CẢNH BÁO: Em không được phép thoát chế độ toàn màn hình trong khi thi! Số lần vi phạm: ${next}`);
          return next;
        });
        setIsFullscreenStarted(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isAntiCheatEnabled, isFullscreenStarted]);

  const calculateScore = () => {
    // Nếu là bài in giấy, bắt buộc học sinh phải điền MÃ ĐỀ trước khi chấm.
    // Nếu học sinh chưa chọn examVersion thì đề trống, không được chấm.
    const isLegacySheet = sourceExam?.templateType === 'LEGACY_PHIU_TRA_LOI';
    if (isLegacySheet && !examVersion) {
      if (availableVersionsState.length > 0) {
        return { p1Score: 0, p2Score: 0, p3Score: 0, total: 0, unansweredCount: 28 };
      }
      return calculateLegacyExamScore(sourceExam || exam, {
        answersPart1,
        answersPart2,
        answersPart3,
      });
    }

    if (isLegacySheet && examVersion) {
      // Học sinh làm theo số thứ tự của version → so sánh trực tiếp với đáp án của version
      const score = calculateLegacyExamScore(exam, {
        answersPart1,
        answersPart2,
        answersPart3,
      });
      return score;
    }

    // Đề online (ONLINE_EXAM) với version: map đáp án về câu gốc rồi chấm theo đề gốc
    const normalizedAnswers = examVersion
      ? mapVersionAnswersToOriginal(examVersion, {
          answersPart1,
          answersPart2,
          answersPart3,
        })
      : {
          answersPart1,
          answersPart2,
          answersPart3,
        };

    const score = calculateLegacyExamScore(sourceExam || exam, normalizedAnswers);

    return score;
  };

  const handleSubmit = async (options?: { autoSubmitted?: boolean }) => {
    if (!assignment || !loggedInStudent) return;
    
    if (sourceExam?.templateType === 'LEGACY_PHIU_TRA_LOI' && availableVersionsState.length > 0 && !examVersion && mode !== 'REVIEW') {
      setAlertDialog({ isOpen: true, message: 'Vui lòng chọn Mã đề thi trước khi nộp bài!', onClose: () => {} });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const scores = calculateScore();
    const submittedAt = Date.now();
    const attempt: Attempt = {
      id: Date.now().toString(),
      assignmentId: assignment.id,
      studentId: loggedInStudent.id,
      classId: assignment.classId,
      teacherId: assignment.teacherId,
      answersPart1,
      answersPart2,
      answersPart3,
      score: scores.total,
      part1Score: scores.p1Score,
      part2Score: scores.p2Score,
      part3Score: scores.p3Score,
      unansweredCount: scores.unansweredCount,
      startedAt,
      autoSubmitted: options?.autoSubmitted || false,
      tabSwitchCount,
      ...(examVersion?.id && { examVersionId: examVersion.id }),
      ...(examVersion?.code && { examVersionCode: examVersion.code }),
      submittedAt
    };
    
      await store.saveAttempt(attempt);
      await store.deleteAttemptDraft(assignment.id, loggedInStudent.id);
      setAlertDialog({
        isOpen: true,
        message: assignment.showScoreImmediately === false || exam?.onlineSettings?.showScoreImmediately === false
          ? 'Nộp bài thành công! Giáo viên chưa bật chế độ hiển thị điểm ngay. Em hãy chờ công bố kết quả.'
          : `Nộp bài thành công! Điểm của em là: ${scores.total.toFixed(2)}/10`,
        onClose: () => navigate('/student')
      });
    } catch (error: any) {
      console.error(error);
      setAlertDialog({
        isOpen: true,
        message: `Lỗi khi nộp bài: ${error?.message || 'Vui lòng kiểm tra kết nối mạng và thử lại.'}`,
        onClose: () => {} // Don't navigate away if it's a network error
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRef = React.useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  useEffect(() => {
    if (!isEnforcedExamMode || !timerStarted) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isEnforcedExamMode, timerStarted]);

  // Bắt đầu đếm giờ khi dữ liệu và trạng thái draft đã sẵn sàng
  useEffect(() => {
    if (exam && assignment && mode !== 'REVIEW' && draftRestored) {
      setTimerStarted(true);
    }
  }, [exam, assignment, mode, draftRestored]);

  useEffect(() => {
    if (!isEnforcedExamMode || !assignment || !loggedInStudent || !draftRestored || !timerStarted) return;

    const saveDraft = async () => {
      if (sourceExam?.templateType === 'LEGACY_PHIU_TRA_LOI' && availableVersionsState.length > 0 && !examVersion && (mode as any) !== 'REVIEW') {
        return; // Không lưu nháp nếu chưa chọn mã đề (với phiếu giấy)
      }

      await store.saveAttemptDraft({
        id: `${assignment.id}_${loggedInStudent.id}`,
        assignmentId: assignment.id,
        studentId: loggedInStudent.id,
        classId: assignment.classId,
        teacherId: assignment.teacherId,
        answersPart1,
        answersPart2,
        answersPart3,
        startedAt,
        updatedAt: Date.now(),
        tabSwitchCount,
        ...(examVersion?.id && { examVersionId: examVersion.id }),
        ...(examVersion?.code && { examVersionCode: examVersion.code }),
      });
      setLastSavedAt(Date.now());
    };

    // Save immediately once the student enters the exam to mark "đã vào làm".
    saveDraft();

    const timer = setInterval(() => {
      saveDraft();
    }, 15000);

    return () => clearInterval(timer);
  }, [isEnforcedExamMode, assignment, loggedInStudent, answersPart1, answersPart2, answersPart3, draftRestored, timerStarted, examVersion, tabSwitchCount]);

  useEffect(() => {
    if (!isAntiCheatEnabled || !timerStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [mode, timerStarted]);

  useEffect(() => {
    if (timeLeft === 0 && !isTimeUp && assignment && mode === 'EXAM') {
      setIsTimeUp(true);
      setAlertDialog({
        isOpen: true,
        message: 'Đã hết thời gian làm bài! Hệ thống sẽ tự động nộp bài.',
        onClose: () => {
          handleSubmitRef.current({ autoSubmitted: true });
        }
      });
    }
  }, [timeLeft, isTimeUp, assignment, mode]);

  if (isPageLoading) {
    return <div className="p-8 text-center">Đang tải dữ liệu đề thi...</div>;
  }

  const alertDialogElement = alertDialog.isOpen && (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 text-left">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Thông báo</h3>
        <p className="text-gray-600 mb-6">{alertDialog.message}</p>
        <button 
          onClick={() => {
            setAlertDialog({ ...alertDialog, isOpen: false });
            alertDialog.onClose();
          }}
          className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
        >
          Đóng
        </button>
      </div>
    </div>
  );

  if (!assignment || !exam || !loggedInStudent) {
    return (
      <>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-lg font-semibold text-slate-700">Không thể mở phiếu luyện lúc này</div>
          <div className="text-sm text-slate-500 max-w-xl">
            Dữ liệu bài giao hoặc đề thi không còn hợp lệ, đã bị xóa, hoặc tài khoản học sinh chưa được liên kết đúng.
            Vui lòng quay lại trang học sinh và mở lại bài.
          </div>
          <button
            type="button"
            onClick={() => navigate('/student')}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Quay lại trang học sinh
          </button>
        </div>
        {alertDialogElement}
      </>
    );
  }

  const handlePart1Select = (qNum: number, answer: string) => {
    if (mode === 'REVIEW') return;
    if (mode === 'PRACTICE' && currentQuestion?.part === 1 && currentQuestion.num !== qNum) return;
    setAnswersPart1(prev => ({ ...prev, [qNum]: answer }));
    
    if (mode === 'PRACTICE') {
      const isCorrect = answer === exam.part1[qNum]?.answer;
      if (isCorrect) {
        setPracticeFeedback('CORRECT');
      } else {
        setWrongAttempts(prev => {
          const newCount = prev + 1;
          setPracticeFeedback(newCount === 1 ? 'WRONG_1' : 'WRONG_2');
          return newCount;
        });
      }
    }
  };

  const handlePart2Select = (qNum: number, sub: string, value: boolean) => {
    if (mode === 'REVIEW') return;
    if (mode === 'PRACTICE' && currentQuestion?.part === 2 && currentQuestion.num !== qNum) return;
    
    setAnswersPart2(prev => ({
      ...prev,
      [qNum]: { ...(prev[qNum] || {}), [sub]: value }
    }));
    
    if (mode === 'PRACTICE') {
      setCurrentQuestion({ part: 2, num: qNum, sub });
      const isCorrect = value === exam.part2[qNum]?.answers?.[sub];
      if (isCorrect) {
        setPracticeFeedback('CORRECT');
      } else {
        setPracticeFeedback('WRONG_2'); // Bỏ qua lần sai 1 (WRONG_1), hiện thẳng đáp án chi tiết
      }
    }
  };

  const handlePart3Change = (qNum: number, value: string) => {
    if (mode === 'REVIEW') return;
    if (mode === 'PRACTICE' && currentQuestion?.part === 3 && currentQuestion.num !== qNum) return;
    setAnswersPart3(prev => ({ ...prev, [qNum]: value }));
  };

  const handlePart3Check = (qNum: number) => {
    if (mode === 'PRACTICE') {
      const studentAnswer = answersPart3[qNum]?.trim().toLowerCase() || '';
      const correctAnswer = exam?.part3[qNum]?.answer?.trim().toLowerCase() || '';
      
      // Basic comparison for now, you could make it more advanced (ignore spaces, punctuation, etc.)
      const isCorrect = studentAnswer === correctAnswer;
      
      if (isCorrect) {
        setPracticeFeedback('CORRECT');
      } else {
        setWrongAttempts(prev => {
          const newCount = prev + 1;
          setPracticeFeedback(newCount === 1 ? 'WRONG_1' : 'WRONG_2');
          return newCount;
        });
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderQuestionContent = (content: string | undefined, className: string) => {
    if (!content) return null;
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(content);
    if (looksLikeHtml) {
      return (
        <div className={className}>
          <RichTextDisplay html={content} />
        </div>
      );
    }
    return <div className={cn(className, "whitespace-pre-line")}>{content}</div>;
  };

  const renderBubble = (label: string, isSelected: boolean, onClick: () => void, disabled: boolean = false, isCorrectReview: boolean = false, isWrongReview: boolean = false) => (
    <button
      translate="no"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "notranslate shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all",
        isSelected && !isCorrectReview && !isWrongReview && "bg-blue-600 border-blue-600 text-white",
        !isSelected && !isCorrectReview && !isWrongReview && "border-gray-400 text-gray-600 hover:border-blue-400 hover:bg-blue-50",
        isCorrectReview && "bg-green-500 border-green-500 text-white",
        isWrongReview && "bg-red-500 border-red-500 text-white hover:bg-red-600 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.5)]",
        disabled && !isSelected && !isCorrectReview && !isWrongReview && "opacity-50 cursor-not-allowed",
        disabled && isSelected && !isCorrectReview && !isWrongReview && "opacity-80 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );

  const renderPracticePopup = () => {
    if (!practiceFeedback || !currentQuestion) return null;
    
    const { part, num: qNum, sub } = currentQuestion;
    
    let explanation = 'Chưa có lời giải chi tiết cho câu này.';
    let hint = undefined;
    let similarExercise: any = undefined;

    if (part === 1) {
      explanation = exam?.part1[qNum]?.explanation || explanation;
      hint = exam?.part1[qNum]?.hint;
      similarExercise = exam?.part1[qNum]?.similarExercise;
    } else if (part === 2 && sub) {
      const subData = exam?.part2[qNum]?.explanations?.[sub];
      explanation = subData?.explanation || exam?.part2[qNum]?.explanation || explanation;
      hint = subData?.hint || exam?.part2[qNum]?.hint;
      similarExercise = subData?.similarExercise;
    } else if (part === 3) {
      explanation = exam?.part3[qNum]?.explanation || explanation;
      hint = exam?.part3[qNum]?.hint;
      similarExercise = exam?.part3[qNum]?.similarExercise;
    }

    const handleNext = () => {
      setPracticeFeedback(null);
      setWrongAttempts(0);
      setReflectionText('');
      if (part === 1) {
        if (qNum < 18) setCurrentQuestion({ part: 1, num: qNum + 1 });
        else setCurrentQuestion({ part: 2, num: 1 });
      } else if (part === 2) {
        // Find next sub-question or next question
        const subs = ['a', 'b', 'c', 'd'];
        const currentSubIdx = subs.indexOf(sub || 'a');
        if (currentSubIdx < 3) {
          // Wait for user to click the next sub-question, so just clear feedback
          setCurrentQuestion({ part: 2, num: qNum });
        } else {
          if (qNum < 4) setCurrentQuestion({ part: 2, num: qNum + 1 });
          else setCurrentQuestion({ part: 3, num: 1 });
        }
      } else if (part === 3) {
        if (qNum < 6) setCurrentQuestion({ part: 3, num: qNum + 1 });
      }
    };

    return (
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-100 p-6 z-50 animate-in slide-in-from-bottom-10 max-h-[85vh] flex flex-col">
        {(practiceFeedback === 'CORRECT' || practiceFeedback === 'WRONG_2') && (
          <div className="text-left flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              {practiceFeedback === 'CORRECT' ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <h3 className="text-xl font-bold text-green-600">Chính xác!</h3>
                </>
              ) : (
                <>
                  <AlertCircle className="w-8 h-8 text-red-500" />
                  <h3 className="text-xl font-bold text-red-600">Vẫn chưa chính xác</h3>
                </>
              )}
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 mb-4 space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                  <Lightbulb className="w-5 h-5" /> Hướng dẫn giải chi tiết {part === 2 && sub ? `(Ý ${sub})` : ''}:
                </h4>
                <div className="text-blue-900 text-sm leading-relaxed whitespace-pre-wrap">
                  <RichTextDisplay html={explanation} />
                </div>
                {hint && (
                  <div className="mt-3 text-sm text-orange-700 bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <strong>💡 Mẹo tránh nhầm:</strong> <RichTextDisplay html={hint} />
                  </div>
                )}
              </div>

              {similarExercise && similarExercise.question && similarExercise.answer ? (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <h4 className="font-bold text-purple-800 mb-2 text-sm flex items-center gap-1.5">
                    <span className="text-lg">🎯</span> Bài tập tương tự (Củng cố kiến thức):
                  </h4>
                  <div className="text-purple-900 text-sm mb-3 font-medium leading-relaxed bg-white p-3 rounded border border-purple-100">
                    <RichTextDisplay html={similarExercise.question} />
                  </div>
                  {['A', 'B', 'C', 'D'].includes(similarExercise.answer.trim().toUpperCase()) ? (
                    <div className="flex gap-2 justify-center mt-4">
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setReflectionText(opt)}
                          className={cn(
                            "w-12 h-12 rounded-full font-bold text-lg transition-all border-2",
                            reflectionText === opt ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-700 border-purple-200 hover:bg-purple-100"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : ['ĐÚNG', 'SAI'].includes(similarExercise.answer.trim().toUpperCase()) ? (
                    <div className="flex gap-4 justify-center mt-4">
                      {['ĐÚNG', 'SAI'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setReflectionText(opt)}
                          className={cn(
                            "px-6 py-2 rounded-full font-bold text-lg transition-all border-2",
                            reflectionText === opt ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-700 border-purple-200 hover:bg-purple-100"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={reflectionText}
                      onChange={(e) => setReflectionText(e.target.value)}
                      placeholder="Nhập đáp án của em..."
                      className="w-full bg-white border border-purple-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-300 outline-none"
                    />
                  )}
                  
                  {reflectionText && reflectionText.toUpperCase().trim() !== similarExercise.answer.toUpperCase().trim() && (
                    <p className="text-red-500 text-xs font-bold mt-3 text-center">Chưa đúng, em hãy thử lại nhé!</p>
                  )}
                  {reflectionText && reflectionText.toUpperCase().trim() === similarExercise.answer.toUpperCase().trim() && (
                    <p className="text-green-600 text-sm font-bold mt-3 text-center flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4" /> Chính xác!</p>
                  )}
                </div>
              ) : (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <h4 className="font-bold text-purple-800 mb-2 text-sm flex items-center gap-1.5">
                    <span className="text-lg">🧠</span> Củng cố kiến thức:
                  </h4>
                  <p className="text-purple-700 text-sm mb-3 font-medium leading-relaxed">Em đã hiểu rõ vì sao mình làm sai chưa?</p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setReflectionText("Em đã hiểu rõ lý thuyết và cách làm.")}
                      className={cn(
                        "text-left px-4 py-2.5 rounded-lg text-sm font-medium border transition-all",
                        reflectionText === "Em đã hiểu rõ lý thuyết và cách làm." ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-700 border-purple-200 hover:bg-purple-100"
                      )}
                    >
                      💡 Em đã hiểu rõ lý thuyết và cách làm.
                    </button>
                    <button
                      onClick={() => setReflectionText("Em nhớ nhầm công thức / khái niệm.")}
                      className={cn(
                        "text-left px-4 py-2.5 rounded-lg text-sm font-medium border transition-all",
                        reflectionText === "Em nhớ nhầm công thức / khái niệm." ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-700 border-purple-200 hover:bg-purple-100"
                      )}
                    >
                      📝 Em nhớ nhầm công thức / khái niệm.
                    </button>
                    <button
                      onClick={() => setReflectionText("Em đọc sai đề bài / Tính toán nhầm.")}
                      className={cn(
                        "text-left px-4 py-2.5 rounded-lg text-sm font-medium border transition-all",
                        reflectionText === "Em đọc sai đề bài / Tính toán nhầm." ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-700 border-purple-200 hover:bg-purple-100"
                      )}
                    >
                      ⚠️ Em đọc sai đề bài / Tính toán nhầm.
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleNext}
              disabled={!reflectionText || (similarExercise?.question ? reflectionText.toUpperCase().trim() !== similarExercise.answer.toUpperCase().trim() : false)}
              className={cn(
                "w-full py-3 text-white rounded-lg font-bold transition-all shrink-0 flex items-center justify-center gap-2 mt-auto",
                (!reflectionText || (similarExercise?.question ? reflectionText.toUpperCase().trim() !== similarExercise.answer.toUpperCase().trim() : false))
                  ? "bg-gray-300 cursor-not-allowed text-gray-500" 
                  : (practiceFeedback === 'CORRECT' ? "bg-green-500 hover:bg-green-600" : "bg-blue-600 hover:bg-blue-700")
              )}
            >
              {(!reflectionText || (similarExercise?.question ? reflectionText.toUpperCase().trim() !== similarExercise.answer.toUpperCase().trim() : false)) ? "Hoàn thành củng cố để tiếp tục" : "Đã hiểu & Tiếp tục"} <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {practiceFeedback === 'WRONG_1' && (
          <div className="text-center">
            <XCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-orange-600 mb-2">Chưa đúng rồi!</h3>
            <p className="text-gray-600 mb-6">Hãy đọc kỹ lại đề và thử lại một lần nữa nhé.</p>
            <button 
              onClick={() => setPracticeFeedback(null)}
              className="w-full py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600"
            >
              Thử lại ngay
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderAiPopup = () => {
    if (!activeAITutor) return null;
    
    let teacherHtml = '';
    if (activeAITutor.part === 1) {
      teacherHtml = exam?.part1[activeAITutor.num]?.explanation || '';
    } else if (activeAITutor.part === 2 && activeAITutor.sub) {
      teacherHtml = exam?.part2[activeAITutor.num]?.explanations?.[activeAITutor.sub]?.explanation || '';
    } else if (activeAITutor.part === 3) {
      teacherHtml = exam?.part3[activeAITutor.num]?.explanation || '';
    }

    return (
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm sm:max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
          <div className="bg-blue-600 p-4 flex items-center gap-3 text-white shrink-0">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Hướng dẫn giải chi tiết</h3>
              <p className="text-blue-100 text-xs font-medium">Từ giáo viên bộ môn</p>
            </div>
          </div>
          
          <div className="p-5 overflow-y-auto flex-1 bg-gray-50 space-y-4">
            {teacherHtml ? (
              <div className="bg-white border border-blue-100 p-4 rounded-xl shadow-sm">
                <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                  <RichTextDisplay html={teacherHtml} />
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                Giáo viên chưa cập nhật lời giải chi tiết cho câu này.
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-100 bg-white shrink-0">
            <button 
              onClick={() => setActiveAITutor(null)}
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-base transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              EM ĐÃ HIỂU BÀI
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isAntiCheatEnabled && !isFullscreenStarted && !isPageLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-rose-500/30 text-slate-900">
        <div className="bg-white rounded-[2rem] p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500 to-orange-500"></div>
          <AlertCircle className="w-20 h-20 text-rose-500 mx-auto mb-6 bg-rose-50 p-4 rounded-full" />
          <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-3">VÀO PHÒNG THI</h2>
          <p className="text-slate-600 mb-6 font-medium leading-relaxed">
            Bài thi yêu cầu chế độ Toàn Màn Hình. 
            Nếu em cố tình thoát màn hình hoặc đóng, chuyển tab, hệ thống sẽ tự động ghi nhận vi phạm!
          </p>
          {tabSwitchCount > 0 && (
            <div className="text-sm font-bold text-rose-600 mb-6 bg-rose-50 p-3 rounded-xl border border-rose-200 inline-flex mx-auto items-center gap-2">
              <XCircle className="w-4 h-4" />
              Số lần vi phạm gian lận: {tabSwitchCount}
            </div>
          )}
          <button
            onClick={async () => {
              try {
                if (document.documentElement.requestFullscreen) {
                  await document.documentElement.requestFullscreen();
                }
                setIsFullscreenStarted(true);
                setCheatWarning(null);
              } catch (err) {
                console.error(err);
                alert('Không thể mở toàn màn hình. Trình duyệt hoặc thiết bị của bạn có thể không hỗ trợ.');
                setIsFullscreenStarted(true); // fall back fallback incase iOS safari
              }
            }}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-95"
          >
            ĐÃ HIỂU & BẮT ĐẦU LÀM
          </button>
        </div>
      </div>
    );
  }

  return (
    <div translate="no" className="notranslate min-h-screen bg-gray-100 md:py-8 md:px-4 font-sans">
      <div className="max-w-4xl mx-auto bg-white shadow-xl md:rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="border-b-4 border-red-600 p-4 md:p-8 text-center bg-red-50">
          <h1 className="text-2xl md:text-4xl font-black text-red-700 tracking-tight mb-1 md:mb-2">
            PHIẾU TRẢ LỜI TRẮC NGHIỆM
          </h1>
          <p className="text-red-600 font-medium text-sm md:text-lg">HỆ THỐNG THI VÀ ÔN LUYỆN THÔNG MINH</p>
        </div>

        {/* Student Info Section */}
        <div className="p-4 md:p-8 border-b-2 border-gray-200 bg-gray-50 flex flex-col md:flex-row gap-6 md:gap-8">
          <div className="flex-1 space-y-3 md:space-y-4">
            <div className="flex items-end gap-2 text-sm md:text-base">
              <span className="font-bold text-gray-700 whitespace-nowrap w-[85px] md:w-[100px] shrink-0">Kỳ thi:</span>
              <div className="border-b-2 border-dotted border-gray-400 flex-1 pb-0.5 font-medium text-blue-800">Khảo sát chất lượng</div>
            </div>
            <div className="flex items-end gap-2 text-sm md:text-base">
              <span className="font-bold text-gray-700 whitespace-nowrap w-[85px] md:w-[100px] shrink-0">Bài thi:</span>
              <div className="border-b-2 border-dotted border-gray-400 flex-1 pb-0.5 font-medium text-blue-800 line-clamp-1">{exam.title}</div>
            </div>
            <div className="flex items-end gap-2 text-sm md:text-base">
              <span className="font-bold text-gray-700 whitespace-nowrap w-[85px] md:w-[100px] shrink-0">Họ và tên:</span>
              <div className="border-b-2 border-dotted border-gray-400 flex-1 pb-0.5 font-bold text-lg md:text-xl text-blue-900 line-clamp-1">{loggedInStudent.fullName}</div>
            </div>
            <div className="flex items-end gap-2 text-sm md:text-base">
              <span className="font-bold text-gray-700 whitespace-nowrap w-[85px] md:w-[100px] shrink-0">Lớp:</span>
              <div className="border-b-2 border-dotted border-gray-400 flex-1 pb-0.5 font-bold text-base md:text-lg text-blue-900">{classes.find(c => c.id === loggedInStudent.classId)?.name || 'Không xác định'}</div>
            </div>
          </div>
          
          <div className="flex flex-row justify-center gap-3 sm:gap-6">
            {/* SBD Grid */}
            <div className="border-2 border-red-600 rounded-xl p-2 sm:p-3 bg-white shadow-sm flex-1 max-w-[160px] sm:max-w-none">
              <div className="text-center font-bold text-red-600 text-[10px] sm:text-sm mb-2 border-b border-red-200 pb-1">SỐ BÁO DANH</div>
              <div className="flex justify-center gap-0.5 sm:gap-1">
                {loggedInStudent.sbd.split('').map((num, i) => (
                  <div key={i} className="w-5 sm:w-6 h-7 sm:h-8 border border-gray-300 flex items-center justify-center font-mono font-bold text-sm sm:text-lg bg-gray-50 rounded-sm">
                    {num}
                  </div>
                ))}
              </div>
            </div>
            {/* Mã Đề Grid */}
            <div className="border-2 border-red-600 rounded-xl p-2 sm:p-3 bg-white shadow-sm flex-1 max-w-[150px] sm:max-w-[200px]">
              <div className="text-center font-bold text-red-600 text-[10px] sm:text-sm mb-2 border-b border-red-200 pb-1">SẼ ĐƯỢC CHẤM MÃ ĐỀ:</div>
              {sourceExam?.templateType === 'LEGACY_PHIU_TRA_LOI' && availableVersionsState.length > 0 && mode !== 'REVIEW' ? (
                <select
                  value={examVersion?.id || ''}
                  onChange={(e) => {
                    const v = availableVersionsState.find(v => v.id === e.target.value);
                    setExamVersion(v || null);
                    setExam(v?.derivedExam || sourceExam);
                  }}
                  className="w-full border-2 border-red-400 bg-red-50 text-red-700 font-bold font-mono text-center text-sm md:text-lg rounded-lg py-1.5 md:py-2 outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">- Chọn Mã -</option>
                  {availableVersionsState.map(v => (
                    <option key={v.id} value={v.id}>{v.code}</option>
                  ))}
                </select>
              ) : (
                <div className="flex justify-center gap-0.5 sm:gap-1">
                  {examVersionDigits.map((num, i) => (
                    <div key={i} className="w-5 sm:w-6 h-7 sm:h-8 border border-gray-300 flex items-center justify-center font-mono font-bold text-sm sm:text-lg bg-gray-50 rounded-sm">
                      {num}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mode Indicator - Sticky for mobile app feel */}
        <div className="sticky top-0 z-40 bg-blue-600 text-white py-2.5 px-4 md:px-8 flex justify-between items-center shadow-md gap-4">
          <div className="min-w-0">
            <div className="font-bold flex items-center gap-2 text-xs md:text-base">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0"></span>
              <span className="truncate max-w-[150px] sm:max-w-none">
                {mode === 'EXAM' ? 'THI ONLINE' : mode === 'PRACTICE' ? 'ÔN LUYỆN' : 'XEM LẠI BÀI'}
              </span>
            </div>
            {isEnforcedExamMode && (
              <div className="mt-1 text-[11px] md:text-xs text-blue-100">
                {lastSavedAt ? `Đã lưu nháp lúc ${new Date(lastSavedAt).toLocaleTimeString('vi-VN')}` : 'Đang chuẩn bị lưu nháp tự động...'}
              </div>
            )}
          </div>
          {isEnforcedExamMode && (
            <div className="flex items-center gap-2">
              {examVersion?.code && (
                <div className="font-bold text-xs md:text-sm px-3 py-1 rounded-lg bg-emerald-700 text-white shadow-sm">
                  Mã đề {examVersion.code}
                </div>
              )}
              <div className={cn(
                "font-mono font-bold text-sm md:text-xl px-3 py-1 rounded-lg flex items-center gap-1.5 md:gap-2 shadow-sm",
                timeLeft <= 300 ? "bg-red-600 animate-pulse" : "bg-blue-800"
              )}>
                <Clock className="w-4 h-4 md:w-5 md:h-5" />
                {formatTime(timeLeft)}
              </div>
            </div>
          )}
        </div>

        {mode === 'REVIEW' && (
          <div className="bg-white border-b border-gray-200">
            <div className="flex">
              <button 
                onClick={() => setReviewTab('STUDENT_WORK')}
                className={cn(
                  "flex-1 py-4 font-bold text-lg border-b-4 transition-colors",
                  reviewTab === 'STUDENT_WORK' ? "border-blue-600 text-blue-600 bg-blue-50" : "border-transparent text-gray-500 hover:bg-gray-50"
                )}
              >
                1. Bài Làm Học sinh
              </button>
              <button 
                onClick={() => setReviewTab('ANSWER_KEY')}
                className={cn(
                  "flex-1 py-4 font-bold text-lg border-b-4 transition-colors",
                  reviewTab === 'ANSWER_KEY' ? "border-green-600 text-green-600 bg-green-50" : "border-transparent text-gray-500 hover:bg-gray-50"
                )}
              >
                2. Đáp án và giải chi tiết
              </button>
            </div>
          </div>
        )}

        <div className="p-4 md:p-8 space-y-8 md:space-y-12">
          {/* PHẦN I */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-black text-gray-800 bg-gray-200 px-3 md:px-4 py-1 rounded-md inline-block w-fit">PHẦN I</h2>
              <p className="text-gray-600 font-medium text-sm md:text-base">Trắc nghiệm nhiều lựa chọn (18 câu)</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-4">
              {Array.from({ length: 18 }).map((_, i) => {
                const qNum = i + 1;
                const isCurrent = mode === 'PRACTICE' && currentQuestion?.part === 1 && currentQuestion.num === qNum;
                const isDisabled = mode === 'PRACTICE' && !isCurrent;

                return (
                  <React.Fragment key={qNum}>
                    <div className={cn(
                      "p-4 rounded-lg transition-colors border border-gray-100",
                      isCurrent && "bg-blue-50 ring-2 ring-blue-200"
                    )}>
                      <div className="flex gap-3">
                        <span className="font-bold text-lg w-8 text-right text-gray-700 shrink-0">{qNum}.</span>
                        <div className="flex-1 space-y-3">
                          {renderQuestionContent(exam.part1[qNum]?.question, "text-gray-800 text-sm md:text-base leading-relaxed")}
                          <div className="space-y-2">
                            {['A', 'B', 'C', 'D'].map(opt => (
                              <div key={`choice-${qNum}-${opt}`} className="flex items-start gap-3">
                                {renderBubble(
                                  opt,
                                  answersPart1[qNum] === opt,
                                  () => {
                                    const isStudentChoice = answersPart1[qNum] === opt;
                                    const isActualCorrect = exam.part1[qNum]?.answer === opt;
                                    const isWrongReview = mode === 'REVIEW' && reviewTab === 'STUDENT_WORK' && isStudentChoice && !isActualCorrect;
                                    if (isWrongReview) {
                                      handleAiHelp(1, qNum);
                                    } else {
                                      handlePart1Select(qNum, opt);
                                    }
                                  },
                                  isDisabled,
                                  mode === 'REVIEW' && ((reviewTab === 'STUDENT_WORK' && answersPart1[qNum] === opt && exam.part1[qNum]?.answer === opt) || (reviewTab === 'ANSWER_KEY' && exam.part1[qNum]?.answer === opt)),
                                  mode === 'REVIEW' && reviewTab === 'STUDENT_WORK' && answersPart1[qNum] === opt && exam.part1[qNum]?.answer !== opt
                                )}
                                {renderQuestionContent(
                                  exam.part1[qNum]?.choices?.[opt] || `Đáp án ${opt}`,
                                  "flex-1 text-sm text-gray-700 pt-1 leading-relaxed"
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                  </div>
                  {mode === 'REVIEW' && reviewTab === 'ANSWER_KEY' && exam.part1[qNum]?.explanation && (
                    <div className="mt-2 text-sm text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-100 col-span-full">
                      <div className="font-bold text-blue-800 mb-1">Lời giải chi tiết:</div>
                      <RichTextDisplay html={exam.part1[qNum].explanation!} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          </section>

          <hr className="border-2 border-gray-100" />

          {/* PHẦN II */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-black text-gray-800 bg-gray-200 px-3 md:px-4 py-1 rounded-md inline-block w-fit">PHẦN II</h2>
              <p className="text-gray-600 font-medium text-sm md:text-base">Trắc nghiệm Đúng/Sai (4 câu)</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {Array.from({ length: 4 }).map((_, i) => {
                const qNum = i + 1;
                const isCurrent = mode === 'PRACTICE' && currentQuestion?.part === 2 && currentQuestion.num === qNum;
                const isDisabled = mode === 'PRACTICE' && !isCurrent;

                return (
                  <div key={qNum} className={cn(
                    "bg-gray-50 p-4 rounded-xl border border-gray-200",
                    isCurrent && "bg-blue-50 border-blue-300 shadow-sm"
                  )}>
                    <div className="font-bold text-lg mb-4 text-gray-800 border-b border-gray-200 pb-2">Câu {qNum}</div>
                    {renderQuestionContent(exam.part2[qNum]?.question, "mb-4 text-sm md:text-base text-gray-800 leading-relaxed")}
                    <div className="space-y-3">
                      {['a', 'b', 'c', 'd'].map(sub => {
                        let isTrueCorrectReview = false;
                        let isTrueWrongReview = false;
                        let isFalseCorrectReview = false;
                        let isFalseWrongReview = false;

                        if (mode === 'REVIEW') {
                          const studentChoice = answersPart2[qNum]?.[sub];
                          const actualCorrect = exam.part2[qNum]?.answers?.[sub];

                          if (reviewTab === 'STUDENT_WORK') {
                            if (studentChoice === true) {
                              isTrueCorrectReview = actualCorrect === true;
                              isTrueWrongReview = actualCorrect !== true;
                            } else if (studentChoice === false) {
                              isFalseCorrectReview = actualCorrect === false;
                              isFalseWrongReview = actualCorrect !== false;
                            }
                          } else if (reviewTab === 'ANSWER_KEY') {
                            if (actualCorrect === true) {
                              isTrueCorrectReview = true;
                            } else if (actualCorrect === false) {
                              isFalseCorrectReview = true;
                            }
                          }
                        }

                        return (
                          <div key={sub} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3 flex-1 pr-4">
                                <span translate="no" className="notranslate font-bold text-gray-600 w-8 shrink-0">{sub})</span>
                                {renderQuestionContent(
                                  exam.part2[qNum]?.statements?.[sub] || `Phát biểu ${sub})`,
                                  "text-sm text-gray-700 pt-1 leading-relaxed"
                                )}
                              </div>
                              <div className="flex gap-4">
                                <button
                                  onClick={() => {
                                    if (mode === 'REVIEW' && reviewTab === 'STUDENT_WORK' && isTrueWrongReview) {
                                      handleAiHelp(2, qNum, sub);
                                    } else {
                                      handlePart2Select(qNum, sub, true);
                                    }
                                  }}
                                  disabled={isDisabled || (mode === 'REVIEW' && !(reviewTab === 'STUDENT_WORK' && isTrueWrongReview))}
                                  className={cn(
                                    "px-6 py-1.5 rounded-full font-bold text-sm border-2 transition-all shrink-0",
                                    answersPart2[qNum]?.[sub] === true && !isTrueCorrectReview && !isTrueWrongReview && "bg-green-500 border-green-500 text-white",
                                    answersPart2[qNum]?.[sub] !== true && !isTrueCorrectReview && !isTrueWrongReview && "border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600",
                                    isTrueCorrectReview && "bg-green-600 border-green-600 text-white",
                                    isTrueWrongReview && "bg-red-500 border-red-500 text-white hover:bg-red-600 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.5)]",
                                    (isDisabled || (mode === 'REVIEW' && !(reviewTab === 'STUDENT_WORK' && isTrueWrongReview))) && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  ĐÚNG
                                </button>
                                <button
                                  onClick={() => {
                                    if (mode === 'REVIEW' && reviewTab === 'STUDENT_WORK' && isFalseWrongReview) {
                                      handleAiHelp(2, qNum, sub);
                                    } else {
                                      handlePart2Select(qNum, sub, false);
                                    }
                                  }}
                                  disabled={isDisabled || (mode === 'REVIEW' && !(reviewTab === 'STUDENT_WORK' && isFalseWrongReview))}
                                  className={cn(
                                    "px-6 py-1.5 rounded-full font-bold text-sm border-2 transition-all shrink-0",
                                    answersPart2[qNum]?.[sub] === false && !isFalseCorrectReview && !isFalseWrongReview && "bg-red-500 border-red-500 text-white",
                                    answersPart2[qNum]?.[sub] !== false && !isFalseCorrectReview && !isFalseWrongReview && "border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-600",
                                    isFalseCorrectReview && "bg-green-600 border-green-600 text-white",
                                    isFalseWrongReview && "bg-red-500 border-red-500 text-white hover:bg-red-600 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.5)]",
                                    (isDisabled || (mode === 'REVIEW' && !(reviewTab === 'STUDENT_WORK' && isFalseWrongReview))) && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  SAI
                                </button>
                              </div>
                            </div>
                            {mode === 'REVIEW' && reviewTab === 'ANSWER_KEY' && exam.part2[qNum]?.explanations?.[sub]?.explanation && (
                              <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-100 mt-1">
                                <div className="font-bold text-blue-800 mb-1">Lời giải chi tiết ý {sub}:</div>
                                <RichTextDisplay html={exam.part2[qNum].explanations[sub].explanation!} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <hr className="border-2 border-gray-100" />

          {/* PHẦN III */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-black text-gray-800 bg-gray-200 px-3 md:px-4 py-1 rounded-md inline-block w-fit">PHẦN III</h2>
              <p className="text-gray-600 font-medium text-sm md:text-base">Trắc nghiệm trả lời ngắn (6 câu)</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8">
              {Array.from({ length: 6 }).map((_, i) => {
                const qNum = i + 1;
                const isCurrent = mode === 'PRACTICE' && currentQuestion?.part === 3 && currentQuestion.num === qNum;
                const isDisabled = mode === 'PRACTICE' && !isCurrent;

                let isCorrectReview = false;
                let isWrongReview = false;
                if (mode === 'REVIEW') {
                  const studentChoice = answersPart3[qNum]?.trim().toLowerCase();
                  const actualCorrect = exam.part3[qNum]?.answer?.trim().toLowerCase();
                  
                  if (reviewTab === 'STUDENT_WORK') {
                    if (studentChoice === actualCorrect) {
                      isCorrectReview = true;
                    } else if (studentChoice) {
                      isWrongReview = true;
                    }
                  } else if (reviewTab === 'ANSWER_KEY') {
                    isCorrectReview = true;
                  }
                }

                return (
                  <React.Fragment key={qNum}>
                    <div className={cn(
                      "flex flex-col gap-2 p-3 rounded-lg",
                      isCurrent && "bg-blue-50 ring-2 ring-blue-200"
                    )}>
                      <label className="font-bold text-gray-700">Câu {qNum}:</label>
                      {renderQuestionContent(exam.part3[qNum]?.question, "text-sm md:text-base text-gray-800 leading-relaxed")}
                      <div className="flex gap-2 items-stretch">
                        <input 
                          type="text" 
                          disabled={isDisabled || mode === 'REVIEW'}
                          value={mode === 'REVIEW' && reviewTab === 'ANSWER_KEY' ? exam.part3[qNum]?.answer || '' : answersPart3[qNum] || ''}
                          onChange={(e) => handlePart3Change(qNum, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && mode === 'PRACTICE' && isCurrent) {
                              handlePart3Check(qNum);
                            }
                          }}
                          className={cn(
                            "flex-1 border-2 rounded-md px-4 py-2 text-lg font-mono outline-none transition-all",
                            !isCorrectReview && !isWrongReview && "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-400",
                            isCorrectReview && "border-green-500 bg-green-50 text-green-700",
                            isWrongReview && "border-red-500 bg-red-50 text-red-700 shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer"
                          )}
                          placeholder="Nhập đáp án..."
                        />
                        {mode === 'PRACTICE' && isCurrent && (
                          <button
                            onClick={() => handlePart3Check(qNum)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition-colors shrink-0"
                          >
                            Kiểm tra
                          </button>
                        )}
                      </div>
                      {mode === 'REVIEW' && reviewTab === 'STUDENT_WORK' && isWrongReview && (
                        <button
                          onClick={() => handleAiHelp(3, qNum)}
                          className="mt-2 text-sm bg-red-100 text-red-700 hover:bg-red-200 py-1.5 rounded-md font-bold flex items-center justify-center gap-1 transition-colors border border-red-200"
                        >
                          <Lightbulb className="w-4 h-4" /> Bấm để xem hướng dẫn giải chi tiết
                        </button>
                      )}
                    </div>
                    {mode === 'REVIEW' && reviewTab === 'ANSWER_KEY' && exam.part3[qNum]?.explanation && (
                      <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-100 mt-[-10px] mb-4 col-span-full">
                        <div className="font-bold text-blue-800 mb-1">Lời giải chi tiết:</div>
                        <RichTextDisplay html={exam.part3[qNum].explanation!} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 p-4 md:p-8 border-t-2 border-gray-200 flex justify-center md:justify-end safe-pb pb-12 pt-8">
          {mode === 'EXAM' && (
            <button 
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="w-full md:w-auto bg-red-600 hover:bg-red-700 disabled:opacity-75 disabled:cursor-not-allowed text-white px-8 md:px-12 py-3.5 md:py-4 rounded-xl font-black text-lg md:text-xl shadow-[0_8px_30px_rgb(220,38,38,0.3)] hover:shadow-[0_8px_30px_rgb(220,38,38,0.5)] transition-all transform hover:-translate-y-1 active:scale-95"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" /> ĐANG TẢI...
                </span>
              ) : (
                `NỘP BÀI THI (${calculateScore().unansweredCount} câu chưa làm)`
              )}
            </button>
          )}
          {mode === 'PRACTICE' && (
            <button 
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-75 disabled:cursor-not-allowed text-white px-6 md:px-8 py-3 rounded-xl font-bold shadow-md text-lg active:scale-95 transition-transform"
            >
              {isSubmitting ? 'ĐANG XỬ LÝ...' : 'Kết thúc phiên ôn luyện'}
            </button>
          )}
        </div>
      </div>
      
      {renderPracticePopup()}
      {renderAiPopup()}

      {/* Cheat Warning Modal */}
      {cheatWarning && (
        <div className="fixed inset-0 bg-rose-950/90 backdrop-blur-md flex items-center justify-center z-[150] p-4 text-slate-900">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
            <div className="mx-auto w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6">
              <XCircle className="w-12 h-12 text-rose-600 animate-pulse" />
            </div>
            <h3 className="text-3xl font-black text-rose-600 mb-4 uppercase tracking-tight">VI PHẠM!</h3>
            <p className="text-slate-700 font-bold mb-8 text-lg border-2 border-rose-200 bg-rose-50 rounded-xl p-4">{cheatWarning}</p>
            <button
              onClick={async () => {
                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                  try {
                    await document.documentElement.requestFullscreen();
                    setIsFullscreenStarted(true);
                  } catch(e) {
                    setIsFullscreenStarted(true);
                  }
                } else {
                  setIsFullscreenStarted(true);
                }
                setCheatWarning(null);
              }}
              className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-2xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95"
            >
              TÔI ĐÃ HIỂU
            </button>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertDialogElement}
    </div>
  );
}
