import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, MessageSquare, Lightbulb, Eye, Edit3, Copy, Upload, FileDown, AlertTriangle, CheckCircle2, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { store } from '@/lib/store';
import { Exam, ExamImportWarning, ExamStatus, ExamTemplateType, Part1QuestionData, Part2QuestionData, Part3QuestionData } from '@/types';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useAuth } from '@/lib/AuthContext';
import { downloadWordImportTemplate, parseExamFromWordFile, wordFileNeedsRichImport } from '@/lib/wordImport';
import { normalizeWordFileWithAI } from '@/lib/wordImportApi';
import { saveImportReviewDraft } from '@/lib/importReviewDraft';

const ExplanationEditor = ({ id, data, setData, qNum, sub, expandedExplanation }: { id: string, data: any, setData: any, qNum: number, sub?: string, expandedExplanation: string | null }) => {
  if (expandedExplanation !== id) return null;

  const currentData = sub ? data[qNum]?.explanations?.[sub] : data[qNum];
  const currentExplanation = currentData?.explanation || '';
  const currentHint = currentData?.hint || '';
  const currentSimilarExercise = currentData?.similarExercise || { question: '', answer: '' };

  const updateData = (field: 'explanation' | 'hint', value: string) => {
    setData((prev: any) => {
      if (sub) {
        const currentExplanations = prev[qNum]?.explanations || {};
        return {
          ...prev,
          [qNum]: {
            ...prev[qNum],
            explanations: {
              ...currentExplanations,
              [sub]: {
                ...(currentExplanations[sub] || {}),
                [field]: value
              }
            }
          }
        };
      } else {
        return {
          ...prev,
          [qNum]: {
            ...prev[qNum],
            [field]: value
          }
        };
      }
    });
  };

  const updateSimilarExercise = (field: 'question' | 'answer', value: string) => {
    setData((prev: any) => {
      const updatedExercise = {
        ...currentSimilarExercise,
        [field]: value
      };
      
      if (sub) {
        const currentExplanations = prev[qNum]?.explanations || {};
        return {
          ...prev,
          [qNum]: {
            ...prev[qNum],
            explanations: {
              ...currentExplanations,
              [sub]: {
                ...(currentExplanations[sub] || {}),
                similarExercise: updatedExercise
              }
            }
          }
        };
      } else {
        return {
          ...prev,
          [qNum]: {
            ...prev[qNum],
            similarExercise: updatedExercise
          }
        };
      }
    });
  };

  return (
    <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-6 animate-in slide-in-from-top-2">
      <div>
        <label className="flex items-center gap-2 font-bold text-blue-800 mb-2">
          <MessageSquare className="w-4 h-4" /> Lời giải chi tiết {sub ? `(Ý ${sub})` : ''}
        </label>
        <div className="bg-white">
          <RichTextEditor 
            value={currentExplanation}
            onChange={(value) => updateData('explanation', value)}
            placeholder="Nhập lời giải chi tiết... Sử dụng nút f(x) để chèn công thức Toán học"
          />
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2 font-bold text-orange-700 mb-2">
          <Lightbulb className="w-4 h-4" /> Mẹo tránh nhầm lẫn (Tùy chọn)
        </label>
        <div className="bg-white">
          <RichTextEditor 
            value={currentHint}
            onChange={(value) => updateData('hint', value)}
            placeholder="VD: Đừng quên cân bằng phương trình trước khi tính số mol!"
            className="h-24 mb-12"
          />
        </div>
      </div>
      
      <div className="border-t border-blue-200 pt-4">
        <label className="flex items-center gap-2 font-bold text-purple-700 mb-2">
          <Copy className="w-4 h-4" /> Bài tập tương tự (Khắc sâu kiến thức - Tùy chọn)
        </label>
        <div className="space-y-3">
          <div className="bg-white">
            <RichTextEditor 
              value={currentSimilarExercise.question}
              onChange={(value) => updateSimilarExercise('question', value)}
              placeholder="Nhập nội dung bài tập tương tự (kèm theo các đáp án A, B, C, D nếu là trắc nghiệm)..."
              className="h-32 mb-12"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Đáp án đúng của bài tương tự:</label>
            <input 
              type="text"
              value={currentSimilarExercise.answer}
              onChange={(e) => updateSimilarExercise('answer', e.target.value)}
              placeholder="Nhập đáp án đúng (VD: A, B, ĐÚNG, SAI, 15cm...)"
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const QuestionContentEditor = ({
  label,
  value,
  onChange,
  placeholder,
  className = "h-32 mb-12"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) => {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <div className="bg-white rounded-lg overflow-hidden">
        <RichTextEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={className}
        />
      </div>
    </div>
  );
};

const IMPORT_PROGRESS_STEPS = [
  { threshold: 8, label: 'Đang kiểm tra cấu trúc file Word...' },
  { threshold: 20, label: 'Đang đọc nội dung và nhận diện định dạng...' },
  { threshold: 38, label: 'Đang phát hiện công thức, ảnh và đáp án nổi bật...' },
  { threshold: 58, label: 'AI đang chuẩn hóa đề thi...' },
  { threshold: 78, label: 'Đang tạo bản đề có thể chỉnh sửa...' },
  { threshold: 92, label: 'Đang hoàn tất dữ liệu để chuyển sang màn rà soát...' },
  { threshold: 100, label: 'Đã sẵn sàng mở bản đề đã chuẩn hóa.' },
];

function CircularImportProgress({
  progress,
  label,
}: {
  progress: number;
  label: string;
}) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const circumference = 2 * Math.PI * 48;
  const dashOffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white shadow-2xl p-6 md:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative w-36 h-36">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="48"
                stroke="#E2E8F0"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="60"
                cy="60"
                r="48"
                stroke="url(#progressGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-500 ease-out"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#0EA5E9" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-black text-slate-900">{clampedProgress}%</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">AI Import</div>
            </div>
          </div>

          <h3 className="mt-6 text-xl font-black text-slate-900">Đang chuẩn hóa đề thi</h3>
          <p className="mt-2 text-sm text-slate-600">{label}</p>

          <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Tiến trình</div>
            <div className="mt-3 space-y-2">
              {IMPORT_PROGRESS_STEPS.map((step) => (
                <div key={step.threshold} className="flex items-center gap-3">
                  <div className={cn(
                    'w-2.5 h-2.5 rounded-full transition-colors',
                    clampedProgress >= step.threshold ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]' : 'bg-slate-300'
                  )} />
                  <div className={cn(
                    'text-sm transition-colors',
                    clampedProgress >= step.threshold ? 'text-slate-900 font-semibold' : 'text-slate-500'
                  )}>
                    {step.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Tùy độ dài file và số công thức/ảnh, quá trình này có thể mất từ vài giây đến gần 1 phút.
          </p>
        </div>
      </div>
    </div>
  );
}

interface ExamEditorProps {
  mode?: 'EXAM' | 'SHEET';
}

export default function ExamEditor({ mode = 'EXAM' }: ExamEditorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: examId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState<ExamStatus>('DRAFT');
  const [templateType, setTemplateType] = useState<ExamTemplateType>(
    mode === 'SHEET' ? 'LEGACY_PHIU_TRA_LOI' : 'ONLINE_EXAM'
  );
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [totalScore, setTotalScore] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [showScoreImmediately, setShowScoreImmediately] = useState(true);
  const [showAnswersAfterSubmit, setShowAnswersAfterSubmit] = useState(false);
  const [requirePassword, setRequirePassword] = useState(false);
  const [examPassword, setExamPassword] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImportingWord, setIsImportingWord] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importProgressLabel, setImportProgressLabel] = useState(IMPORT_PROGRESS_STEPS[0].label);
  const [importWarnings, setImportWarnings] = useState<ExamImportWarning[]>([]);
  const [importedFileName, setImportedFileName] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [sheetVersionCountInput, setSheetVersionCountInput] = useState(4);

  // State for answers and explanations
  const [part1Data, setPart1Data] = useState<Record<number, Part1QuestionData>>({});
  const [part2Data, setPart2Data] = useState<Record<number, Part2QuestionData>>({});
  const [part3Data, setPart3Data] = useState<Record<number, Part3QuestionData>>({});

  useEffect(() => {
    if (examId) {
      setIsLoading(true);
      store.getExamById(examId).then((examData) => {
        if (examData) {
          setTitle(examData.title || '');
          setSubject(examData.subject || '');
          setGrade(examData.grade || '');
          setDescription(examData.description || '');
          setInstructions(examData.instructions || '');
          setStatus(examData.status || 'DRAFT');
          setTemplateType(
            mode === 'SHEET'
              ? 'LEGACY_PHIU_TRA_LOI'
              : (examData.templateType || 'LEGACY_PHIU_TRA_LOI')
          );
          setDurationMinutes(examData.onlineSettings?.durationMinutes || 50);
          setTotalScore(examData.onlineSettings?.totalScore || 10);
          setMaxAttempts(examData.onlineSettings?.maxAttempts || 1);
          setShowScoreImmediately(examData.onlineSettings?.showScoreImmediately ?? true);
          setShowAnswersAfterSubmit(examData.onlineSettings?.showAnswersAfterSubmit ?? false);
          setRequirePassword(examData.onlineSettings?.requirePassword ?? false);
          setExamPassword(examData.onlineSettings?.password || '');
          setPart1Data(examData.part1 || {});
          setPart2Data(examData.part2 || {});
          setPart3Data(examData.part3 || {});
          setIsEditing(true);
        }
        setIsLoading(false);
      });
    }
  }, [examId, mode]);

  const preferredImportMode = new URLSearchParams(location.search).get('source') === 'word';

  const sendImportedExamToReview = (
    parsed: {
      title: string;
      subject: string;
      grade: string;
      description: string;
      instructions: string;
      templateType: ExamTemplateType;
      durationMinutes: number;
      totalScore: number;
      maxAttempts: number;
      part1: Record<number, Part1QuestionData>;
      part2: Record<number, Part2QuestionData>;
      part3: Record<number, Part3QuestionData>;
      warnings: ExamImportWarning[];
    },
    fileName: string,
    sourceLabel: string
  ) => {
    saveImportReviewDraft({
      fileName,
      importedAt: Date.now(),
      sourceLabel,
      templateType: parsed.templateType,
      title: parsed.title,
      subject: parsed.subject,
      grade: parsed.grade,
      description: parsed.description,
      instructions: parsed.instructions,
      durationMinutes: parsed.durationMinutes,
      totalScore: parsed.totalScore,
      maxAttempts: parsed.maxAttempts,
      part1: parsed.part1,
      part2: parsed.part2,
      part3: parsed.part3,
      warnings: parsed.warnings,
    });
    navigate('/teacher/exam/review');
  };

  const handleWordImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingWord(true);
    setImportProgress(6);
    setImportProgressLabel(IMPORT_PROGRESS_STEPS[0].label);
    setImportMessage('');
    setImportWarnings([]);

    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      progressInterval = setInterval(() => {
        setImportProgress((prev) => {
          const next = prev < 88 ? prev + (prev < 40 ? 7 : prev < 70 ? 4 : 2) : prev;
          const matchedStep = [...IMPORT_PROGRESS_STEPS].reverse().find((step) => next >= step.threshold);
          if (matchedStep) setImportProgressLabel(matchedStep.label);
          return next;
        });
      }, 700);

      const needsRichImport = await wordFileNeedsRichImport(file);
      setImportProgress(needsRichImport ? 24 : 30);
      setImportProgressLabel(needsRichImport ? IMPORT_PROGRESS_STEPS[2].label : IMPORT_PROGRESS_STEPS[1].label);
      try {
        if (needsRichImport) {
          throw new Error('Word file contains rich content; using AI import to preserve formulas and images.');
        }
        const parsed = await parseExamFromWordFile(file);
        setImportProgress(100);
        setImportProgressLabel(IMPORT_PROGRESS_STEPS[IMPORT_PROGRESS_STEPS.length - 1].label);
        sendImportedExamToReview(parsed, file.name, 'Đề được đọc trực tiếp từ file Word theo mẫu chuẩn');
      } catch (localError) {
        setImportProgress(58);
        setImportProgressLabel(IMPORT_PROGRESS_STEPS[3].label);
        const aiResult = await normalizeWordFileWithAI(file);
        setImportProgress(100);
        setImportProgressLabel(IMPORT_PROGRESS_STEPS[IMPORT_PROGRESS_STEPS.length - 1].label);
        sendImportedExamToReview(
          aiResult.parsedExam,
          file.name,
          `Đề được AI (${aiResult.model}) chuẩn hóa từ file Word và chuyển sang màn rà soát trước khi tạo đề`
        );
        console.info('Local Word import failed, AI fallback was used:', localError);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đọc file Word này.';
      alert(message);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setIsImportingWord(false);
      setImportProgress(0);
      setImportProgressLabel(IMPORT_PROGRESS_STEPS[0].label);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveExamAndReturnId = async (): Promise<string | null> => {
    if (!title.trim()) {
      alert('Vui lòng nhập tên đề thi!');
      return null;
    }

    if (!userProfile?.uid) {
      alert('Vui lòng đăng nhập lại!');
      return null;
    }

    if (requirePassword && !examPassword.trim()) {
      alert('Vui lòng nhập mật khẩu cho đề thi hoặc tắt yêu cầu mật khẩu.');
      return null;
    }

    const resolvedId = isEditing && examId ? examId : Date.now().toString();
    const newExam: Exam = {
      id: resolvedId,
      title: title.trim(),
      teacherId: userProfile.uid,
      templateType,
      status,
      subject: subject.trim(),
      grade: grade.trim(),
      description,
      instructions,
      onlineSettings: {
        durationMinutes,
        totalScore,
        maxAttempts,
        allowMultipleAttempts: maxAttempts > 1,
        showScoreImmediately,
        showAnswersAfterSubmit,
        requirePassword,
        password: requirePassword ? examPassword : '',
        autoSubmitWhenTimeUp: true,
        allowReviewAfterSubmit: true,
      },
      importSource: importedFileName
        ? {
            type: 'WORD',
            fileName: importedFileName,
            importedAt: Date.now(),
            warnings: importWarnings,
          }
        : isEditing
          ? (await store.getExamById(examId!))?.importSource
          : { type: 'MANUAL', importedAt: Date.now(), warnings: [] },
      part1: part1Data,
      part2: part2Data,
      part3: part3Data,
      updatedAt: Date.now(),
      createdAt: isEditing ? (await store.getExamById(examId!))?.createdAt || Date.now() : Date.now()
    };

    await store.saveExam(newExam);
    return resolvedId;
  };

  const handleSave = async () => {
    const savedId = await saveExamAndReturnId();
    if (!savedId) return;
    alert(`Đã lưu đề thi thành công!\n\n${!isEditing ? 'LƯU Ý: Đề thi mới chỉ được lưu vào kho. Bạn cần quay lại màn hình Quản lý và bấm "Giao bài" để học sinh có thể thấy và làm bài.' : ''}`);
    navigate('/teacher');
  };

  const toggleExplanation = (id: string) => {
    setExpandedExplanation(prev => prev === id ? null : id);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Đang tải dữ liệu đề thi...</div>;
  }

  const isFullContentMode = templateType === 'ONLINE_EXAM';
  const isSheetModePage = mode === 'SHEET';

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans pb-24">
      {isImportingWord && (
        <CircularImportProgress progress={importProgress} label={importProgressLabel} />
      )}
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-200 gap-4 sticky top-3 z-40">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button onClick={() => navigate('/teacher')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-black text-gray-900">
                {isSheetModePage ? 'Tạo Phiếu Trả Lời (đề in giấy)' : 'Tạo Đề Thi Online'}
              </h1>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isSheetModePage ? 'Tên phiếu (VD: Phiếu KSCL 12 - Đề 01)' : 'Tên đề (VD: KSCL 12 - Đề 01)'}
                className="mt-2 w-full md:w-[560px] max-w-full border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button 
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm flex items-center gap-2 transition-all shrink-0"
            >
              <Save className="w-5 h-5" />
              Lưu
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-black text-gray-900">Thiết lập nhanh</h2>
            <p className="text-sm text-gray-500 mt-1">
              {isSheetModePage
                ? 'Trang riêng cho Phiếu in giấy: tạo mã đề 4 số và nhập đáp án/lời giải theo 3 phần.'
                : 'Trang riêng cho Đề online: nhập thông tin đề và nội dung các phần bên dưới.'}
            </p>
          </div>

          <details
            className={cn(
              "rounded-2xl border p-4",
              preferredImportMode ? "border-emerald-300 bg-emerald-50/70" : "border-slate-200 bg-slate-50"
            )}
            open={preferredImportMode}
          >
            <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-900 font-black">
                <Upload className="w-5 h-5 text-emerald-600" />
                Nhập từ Word (tùy chọn)
              </div>
              <div className="text-xs font-bold text-slate-500">Mở / Đóng</div>
            </summary>

            <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="text-sm text-slate-600">
                Chọn file `.docx` theo mẫu. Nếu nhiều công thức/ảnh, hệ thống sẽ tự dùng AI để giữ đúng nội dung.
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadWordImportTemplate()}
                  className="px-4 py-2.5 rounded-xl border border-blue-200 bg-white text-blue-700 font-bold text-sm hover:bg-blue-50 inline-flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Tải mẫu Word
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImportingWord}
                  className="px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isImportingWord ? 'Đang đọc...' : 'Chọn file'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".doc,.docx"
                  className="hidden"
                  onChange={handleWordImport}
                />
              </div>
            </div>

            {(importMessage || importWarnings.length > 0) && (
              <div className="space-y-3">
                {importMessage && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{importMessage}</span>
                  </div>
                )}
                {importWarnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                      <AlertTriangle className="w-4 h-4" />
                      Cảnh báo sau khi import
                    </div>
                    <div className="mt-3 space-y-2">
                      {importWarnings.map((warning) => (
                        <div
                          key={warning.id}
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm border",
                            warning.level === 'error'
                              ? "border-rose-200 bg-rose-50 text-rose-800"
                              : warning.level === 'warning'
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-blue-200 bg-blue-50 text-blue-800"
                          )}
                        >
                          {warning.questionRef ? `${warning.questionRef}: ` : ''}{warning.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </details>

          {!isSheetModePage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Trang này dành cho <b>Đề online</b>. Nếu cần tạo Phiếu in giấy, vào menu <b>Tạo phiếu</b> để dùng trang riêng.
            </div>
          )}
          {isSheetModePage && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Trang này dành riêng cho <b>Phiếu in giấy</b>, mỗi mã đề sẽ nhập đáp án/lời giải theo đủ 3 phần.
            </div>
          )}

          {templateType === 'LEGACY_PHIU_TRA_LOI' && (
            <details className="rounded-2xl border border-blue-200 bg-blue-50 p-4" open>
              <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3">
                <div className="font-black text-blue-900">Mã đề phiếu (4 số)</div>
                <div className="text-xs font-bold text-blue-900/70">Mở / Đóng</div>
              </summary>

              {/* Nút truy cập nhanh khi đang SỬA đề đã có mã phiếu */}
              {isEditing && examId && (
                <div className="mt-4 p-3 rounded-xl border border-orange-200 bg-orange-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm text-orange-800">
                    <span className="font-bold">⚠️ Trang này chỉ sửa đề gốc (câu hỏi).</span><br/>
                    Để xem hoặc chỉnh sửa <strong>đáp án theo từng mã đề</strong>, bấm nút bên phải.
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/teacher/sheet/mix/${examId}`)}
                    className="shrink-0 px-5 py-2.5 rounded-xl font-bold inline-flex items-center gap-2 transition-colors bg-orange-500 text-white hover:bg-orange-600"
                  >
                    📋 Xem/Chỉnh đáp án mã đề
                  </button>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
                <div>
                  <label className="block text-sm font-bold text-blue-900 mb-2">Số lượng mã đề cần tạo</label>
                  <input
                    type="number"
                    min={1}
                    max={48}
                    value={sheetVersionCountInput}
                    onChange={(e) => setSheetVersionCountInput(Math.max(1, Math.min(48, Number(e.target.value) || 1)))}
                    className="w-full lg:w-64 border border-blue-300 rounded-xl px-3 py-2 font-semibold text-blue-900 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                  <div className="text-xs text-blue-900/80 mt-2">
                    Hệ thống sẽ tạo mã đề dạng 4 số: 1101, 1102, 1103... tối đa 48 mã.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const savedId = await saveExamAndReturnId();
                    if (!savedId) return;
                    const safeCount = Math.max(1, Math.min(48, sheetVersionCountInput));
                    navigate(`/teacher/sheet/mix/${savedId}?count=${safeCount}&codeStyle=NUMERIC`);
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold inline-flex items-center gap-2 transition-colors bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Shuffle className="w-4 h-4" />
                  {isEditing ? 'Lưu & Tạo lại mã đề mới' : 'Thiết lập & nhập đáp án theo mã đề'}
                </button>
              </div>
            </details>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Môn</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="VD: Toán, Lý, Hóa..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Khối/Lớp</label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="VD: 12"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3">
              <div className="font-black text-slate-900">Nâng cao (tùy chọn)</div>
              <div className="text-xs font-bold text-slate-500">Mở / Đóng</div>
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Trạng thái</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ExamStatus)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                  >
                    <option value="DRAFT">Nháp</option>
                    <option value="PUBLISHED">Xuất bản</option>
                    <option value="LOCKED">Khóa đề</option>
                    <option value="ARCHIVED">Lưu trữ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Thời gian (phút)</label>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value) || 50)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tổng điểm</label>
                  <input
                    type="number"
                    min={1}
                    value={totalScore}
                    onChange={(e) => setTotalScore(Number(e.target.value) || 10)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Số lần làm tối đa</label>
                  <input
                    type="number"
                    min={1}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value) || 1)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <label className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 bg-white">
                    <input type="checkbox" checked={showScoreImmediately} onChange={(e) => setShowScoreImmediately(e.target.checked)} />
                    <span className="text-sm font-medium text-gray-700">Hiển thị điểm ngay sau khi nộp</span>
                  </label>
                  <label className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 bg-white">
                    <input type="checkbox" checked={showAnswersAfterSubmit} onChange={(e) => setShowAnswersAfterSubmit(e.target.checked)} />
                    <span className="text-sm font-medium text-gray-700">Cho xem đáp án sau khi nộp</span>
                  </label>
                  <label className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 bg-white">
                    <input type="checkbox" checked={requirePassword} onChange={(e) => setRequirePassword(e.target.checked)} />
                    <span className="text-sm font-medium text-gray-700">Yêu cầu mật khẩu khi vào thi</span>
                  </label>
                </div>
              </div>

              {requirePassword && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Mật khẩu đề</label>
                  <input
                    type="text"
                    value={examPassword}
                    onChange={(e) => setExamPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="w-full md:w-1/2 border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Mô tả (ngắn)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Tùy chọn"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Hướng dẫn</label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={3}
                    placeholder="Tùy chọn"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                  />
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
          {[
            { id: 1, label: 'PHẦN I (18 Câu)' },
            { id: 2, label: 'PHẦN II (4 Câu Đ/S)' },
            { id: 3, label: 'PHẦN III (6 Câu Ngắn)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 1|2|3)}
              className={cn(
                "flex-1 py-3 rounded-lg font-bold text-sm transition-all",
                activeTab === tab.id 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          
          {/* PART 1 */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
                <p className="text-blue-800 font-medium text-sm">
                  <strong>Hướng dẫn:</strong> Click vào đáp án đúng. Bấm "Thêm lời giải" để nhập giải thích chi tiết cho chế độ Ôn Luyện.
                </p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Array.from({ length: 18 }).map((_, i) => {
                  const qNum = i + 1;
                  const id = `p1-${qNum}`;
                  const hasExplanation = !!part1Data[qNum]?.explanation;

                  return (
                    <div key={qNum} className="border border-gray-200 p-4 rounded-xl hover:border-blue-300 transition-colors space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-black text-lg text-gray-700 whitespace-nowrap">Câu {qNum}</span>
                        <button 
                          onClick={() => toggleExplanation(id)}
                          className={cn(
                            "text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors",
                            hasExplanation ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"
                          )}
                        >
                          {hasExplanation ? 'Đã có lời giải' : '+ Thêm lời giải'}
                        </button>
                      </div>
                      {isFullContentMode ? (
                        <QuestionContentEditor
                          label="Nội dung câu hỏi"
                          value={part1Data[qNum]?.question || ''}
                          onChange={(value) => setPart1Data(prev => ({ ...prev, [qNum]: { ...prev[qNum], question: value } }))}
                          placeholder={`Nhập nội dung câu ${qNum}. Dùng nút f(x) để chèn công thức Toán, hoặc nhập H2SO4 để editor tự tối ưu công thức Hóa.`}
                          className="h-32 mb-12"
                        />
                      ) : (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
                          Chế độ phiếu học tập online: chỉ cần nhập đáp án đúng cho câu này.
                        </div>
                      )}
                      <div className="space-y-3">
                        {['A', 'B', 'C', 'D'].map(opt => (
                          <div key={opt} className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => setPart1Data(prev => ({
                                ...prev,
                                [qNum]: { ...prev[qNum], answer: opt }
                              }))}
                              className={cn(
                                "w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold transition-all shrink-0",
                                part1Data[qNum]?.answer === opt
                                  ? "bg-green-500 border-green-500 text-white"
                                  : "border-gray-300 text-gray-600 hover:border-green-400 hover:bg-green-50"
                              )}
                            >
                              {opt}
                            </button>
                            {isFullContentMode && (
                              <div className="flex-1">
                                <QuestionContentEditor
                                  label={`Đáp án ${opt}`}
                                  value={part1Data[qNum]?.choices?.[opt] || ''}
                                  onChange={(value) => setPart1Data(prev => ({
                                    ...prev,
                                    [qNum]: {
                                      ...prev[qNum],
                                      choices: {
                                        ...(prev[qNum]?.choices || {}),
                                        [opt]: value
                                      }
                                    }
                                  }))}
                                  placeholder={`Nhập nội dung đáp án ${opt}`}
                                  className="h-24 mb-12"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <ExplanationEditor id={id} data={part1Data} setData={setPart1Data} qNum={qNum} expandedExplanation={expandedExplanation} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PART 2 */}
          {activeTab === 2 && (
            <div className="space-y-8">
              {Array.from({ length: 4 }).map((_, i) => {
                const qNum = i + 1;
                const id = `p2-${qNum}`;

                return (
                  <div key={qNum} className="border border-gray-200 p-6 rounded-xl">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                      <h3 className="font-black text-xl text-gray-800">Câu {qNum}</h3>
                    </div>
                    {isFullContentMode && (
                      <QuestionContentEditor
                        label="Nội dung câu hỏi"
                        value={part2Data[qNum]?.question || ''}
                        onChange={(value) => setPart2Data(prev => ({
                          ...prev,
                          [qNum]: { ...prev[qNum], question: value, answers: prev[qNum]?.answers || {} }
                        }))}
                        placeholder={`Nhập nội dung câu Đúng/Sai ${qNum}`}
                        className="h-32 mb-12"
                      />
                    )}
                    
                    <div className="grid grid-cols-1 gap-4">
                      {['a', 'b', 'c', 'd'].map(sub => {
                        const subId = `${id}-${sub}`;
                        const hasExplanation = !!part2Data[qNum]?.explanations?.[sub]?.explanation;
                        
                        return (
                          <div key={sub} className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              {isFullContentMode && (
                                <div className="flex-1">
                                  <span className="font-bold text-gray-700">Ý {sub})</span>
                                  <div className="mt-2">
                                    <QuestionContentEditor
                                      label={`Nội dung ý ${sub})`}
                                      value={part2Data[qNum]?.statements?.[sub] || ''}
                                      onChange={(value) => setPart2Data(prev => ({
                                        ...prev,
                                        [qNum]: {
                                          ...prev[qNum],
                                          answers: prev[qNum]?.answers || {},
                                          statements: {
                                            ...(prev[qNum]?.statements || {}),
                                            [sub]: value
                                          }
                                        }
                                      }))}
                                      placeholder={`Nhập phát biểu ${sub})`}
                                      className="h-24 mb-12"
                                    />
                                  </div>
                                </div>
                              )}
                              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                                <button 
                                  onClick={() => toggleExplanation(subId)}
                                  className={cn(
                                    "text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors",
                                    hasExplanation ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"
                                  )}
                                >
                                  {hasExplanation ? 'Đã có lời giải' : '+ Thêm lời giải'}
                                </button>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setPart2Data(prev => ({ 
                                      ...prev, 
                                      [qNum]: { ...prev[qNum], answers: { ...(prev[qNum]?.answers || {}), [sub]: true } } 
                                    }))}
                                    className={cn(
                                      "px-4 py-1.5 rounded-full font-bold text-sm border-2 transition-all",
                                      part2Data[qNum]?.answers?.[sub] === true
                                        ? "bg-green-500 border-green-500 text-white"
                                        : "border-gray-300 text-gray-500 hover:border-green-400"
                                    )}
                                  >
                                    ĐÚNG
                                  </button>
                                  <button
                                    onClick={() => setPart2Data(prev => ({ 
                                      ...prev, 
                                      [qNum]: { ...prev[qNum], answers: { ...(prev[qNum]?.answers || {}), [sub]: false } } 
                                    }))}
                                    className={cn(
                                      "px-4 py-1.5 rounded-full font-bold text-sm border-2 transition-all",
                                      part2Data[qNum]?.answers?.[sub] === false
                                        ? "bg-red-500 border-red-500 text-white"
                                        : "border-gray-300 text-gray-500 hover:border-red-400"
                                    )}
                                  >
                                    SAI
                                  </button>
                                </div>
                              </div>
                            </div>
                            <ExplanationEditor id={subId} data={part2Data} setData={setPart2Data} qNum={qNum} sub={sub} expandedExplanation={expandedExplanation} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PART 3 */}
          {activeTab === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => {
                const qNum = i + 1;
                const id = `p3-${qNum}`;
                const hasExplanation = !!part3Data[qNum]?.explanation;

                return (
                  <div key={qNum} className="border border-gray-200 p-5 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                      <label className="font-black text-lg text-gray-800">Câu {qNum}</label>
                      <button 
                        onClick={() => toggleExplanation(id)}
                        className={cn(
                          "text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors",
                          hasExplanation ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"
                        )}
                      >
                        {hasExplanation ? 'Đã có lời giải' : '+ Thêm lời giải'}
                      </button>
                    </div>
                    {isFullContentMode && (
                      <QuestionContentEditor
                        label="Nội dung câu hỏi"
                        value={part3Data[qNum]?.question || ''}
                        onChange={(value) => setPart3Data(prev => ({ ...prev, [qNum]: { ...prev[qNum], question: value } }))}
                        placeholder={`Nhập nội dung câu ngắn ${qNum}`}
                        className="h-32 mb-12"
                      />
                    )}
                    <input 
                      type="text" 
                      value={part3Data[qNum]?.answer || ''}
                      onChange={(e) => setPart3Data(prev => ({ ...prev, [qNum]: { ...prev[qNum], answer: e.target.value } }))}
                      className="w-full border-2 border-gray-300 rounded-md px-4 py-3 text-lg font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      placeholder="Nhập đáp án chính xác..."
                    />
                    <ExplanationEditor id={id} data={part3Data} setData={setPart3Data} qNum={qNum} expandedExplanation={expandedExplanation} />
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
