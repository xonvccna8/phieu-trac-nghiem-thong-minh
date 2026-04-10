import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, BookOpen, Target, Award, CheckCircle2, Eye, Clock, Home, User as UserIcon, LogOut, Trophy, Medal, Crown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { store } from '@/lib/store';
import { Assignment, Attempt, AttemptDraft, Exam, Student, Class, ExamVersion } from '@/types';
import { pickDeterministicExamVersion } from '@/lib/examVersioning';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classmates, setClassmates] = useState<Student[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [allAttempts, setAllAttempts] = useState<Attempt[]>([]);
  const [allAttemptDrafts, setAllAttemptDrafts] = useState<AttemptDraft[]>([]);
  const [examVersionsByExamId, setExamVersionsByExamId] = useState<Record<string, ExamVersion[]>>({});

  const [studentClass, setStudentClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'tasks' | 'profile'>('home');
  const [nowTs, setNowTs] = useState<number>(Date.now());

  useEffect(() => {
    const fetchStudent = async () => {
      if (userProfile && userProfile.role === 'STUDENT') {
        const students = await store.getStudents();
        const student = students.find(s => s.id === userProfile.uid);
        if (student) {
          setLoggedInStudent(student);
        }
      }
      setLoading(false);
    };
    fetchStudent();
  }, [userProfile]);

  useEffect(() => {
    if (!loggedInStudent) return;

    const unsubClasses = store.subscribeToClasses(setClasses, loggedInStudent.teacherId);
    const unsubExams = store.subscribeToExams(setExams, loggedInStudent.teacherId);
    const unsubStudents = store.subscribeToStudents(setClassmates, loggedInStudent.teacherId);
    const unsubAssignments = store.subscribeToStudentAssignments(setAllAssignments, loggedInStudent.classId);
    const unsubAttempts = store.subscribeToClassAttempts(setAllAttempts, loggedInStudent.classId);
    const unsubDrafts = store.subscribeToClassAttemptDrafts(setAllAttemptDrafts, loggedInStudent.classId);

    return () => {
      if (unsubClasses) unsubClasses();
      if (unsubExams) unsubExams();
      if (unsubStudents) unsubStudents();
      if (unsubAssignments) unsubAssignments();
      if (unsubAttempts) unsubAttempts();
      if (unsubDrafts) unsubDrafts();
    };
  }, [loggedInStudent]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loggedInStudent) {
      setAssignments(allAssignments);
      setAttempts(allAttempts.filter(a => a.studentId === loggedInStudent.id));
      
      const studentClassObj = classes.find(c => c.id === loggedInStudent.classId);
      if (studentClassObj) {
        setStudentClass(studentClassObj.name);
      }
    }
  }, [loggedInStudent, allAssignments, allAttempts, classes]);

  useEffect(() => {
    const loadVersions = async () => {
      if (!loggedInStudent || assignments.length === 0) {
        setExamVersionsByExamId({});
        return;
      }

      const uniqueExamIds = Array.from(new Set(assignments.map((a) => a.examId)));
      const entries = await Promise.all(
        uniqueExamIds.map(async (examId) => [examId, await store.getExamVersions(examId)] as const)
      );
      setExamVersionsByExamId(Object.fromEntries(entries));
    };
    loadVersions();
  }, [loggedInStudent, assignments]);

  const [selectedLeaderboardAssignmentId, setSelectedLeaderboardAssignmentId] = useState<string>('');

  useEffect(() => {
    if (!selectedLeaderboardAssignmentId && allAttempts.length > 0) {
      const latestAttempt = [...allAttempts].sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))[0];
      if (latestAttempt) {
        setSelectedLeaderboardAssignmentId(latestAttempt.assignmentId);
      }
    }
  }, [allAttempts, selectedLeaderboardAssignmentId]);

  const handleStartAssignment = (assignment: Assignment) => {
    if (assignment.startDate && new Date() < new Date(assignment.startDate)) {
      alert(`Chưa đến thời gian làm bài.\nThời gian bắt đầu: ${assignment.startDate.replace('T', ' ')}`);
      return;
    }
    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
      alert(`Đã quá hạn làm bài.\nHạn chót: ${assignment.dueDate.replace('T', ' ')}`);
      return;
    }
    navigate(`/exam/${assignment.id}?mode=${assignment.mode}`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-emerald-600">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!loggedInStudent || !userProfile) {
    return <div className="p-8 text-center text-slate-500 bg-slate-50 min-h-screen">Không tìm thấy thông tin học sinh. Vui lòng đăng nhập lại.</div>;
  }

  const recentAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const recentScore = recentAttempt?.score || 0;
  const studentDrafts = allAttemptDrafts.filter(d => d.studentId === loggedInStudent.id);

  const pendingAssignments = assignments.filter(a => !attempts.some(att => att.assignmentId === a.id));
  const completedAssignments = assignments.filter(a => attempts.some(att => att.assignmentId === a.id));
  const urgentNotStartedAssignments = pendingAssignments.filter((assignment) => {
    if (!assignment.startDate) return false;
    const hasStarted = attempts.some(att => att.assignmentId === assignment.id) || studentDrafts.some(d => d.assignmentId === assignment.id);
    return !hasStarted && new Date(assignment.startDate).getTime() <= nowTs;
  });
  const classStudents = classmates.filter(student => student.classId === loggedInStudent.classId);

  let currentRank = 1;
  const rawStats = classStudents.map((student) => {
    const studentAttempts = allAttempts.filter(attempt => attempt.studentId === student.id && attempt.assignmentId === selectedLeaderboardAssignmentId);
    const bestAttempt = studentAttempts.reduce((best, current) => (current.score || 0) > (best?.score || 0) ? current : best, studentAttempts[0]);

    return {
      student,
      score: bestAttempt?.score || 0,
      hasCompleted: !!bestAttempt,
      submittedAt: bestAttempt?.submittedAt || 0,
    };
  }).filter(entry => entry.hasCompleted);

  const rankingEntries = rawStats.sort((a, b) => 
    b.score - a.score ||
    a.submittedAt - b.submittedAt
  ).map((entry, index, arr) => {
    const prev = arr[index - 1];
    const sameAsPrev = prev && prev.score === entry.score;

    if (!sameAsPrev) currentRank = index + 1;

    return {
      ...entry,
      rank: currentRank,
    };
  });

  // Tính rank cho bài mới nhất học sinh vừa làm
  let latestRankText = '--';
  if (recentAttempt) {
    const classAttemptsForLatest = allAttempts.filter(a => a.assignmentId === recentAttempt.assignmentId);
    const bestScores = new Map<string, number>();
    classAttemptsForLatest.forEach(a => {
      const existing = bestScores.get(a.studentId) || -1;
      if ((a.score || 0) > existing) bestScores.set(a.studentId, a.score || 0);
    });
    const sortedScores = Array.from(bestScores.values()).sort((a, b) => b - a);
    const myBest = bestScores.get(loggedInStudent.id) || 0;
    const rankPos = sortedScores.indexOf(myBest) + 1;
    if (rankPos > 0) latestRankText = String(rankPos);
  }

  const currentStudentRanking = rankingEntries.find(entry => entry.student.id === loggedInStudent.id);
  const topThreeStudents = rankingEntries.slice(0, 3);
  const podiumOrder = [1, 0, 2].filter(index => topThreeStudents[index]);

  const podiumStyles = [
    {
      wrapper: 'md:mt-10 bg-gradient-to-b from-amber-100 to-yellow-50 border-amber-200',
      icon: <Crown className="w-6 h-6 text-amber-500" />,
      height: 'h-44',
      label: 'Hạng 1',
    },
    {
      wrapper: 'bg-gradient-to-b from-slate-100 to-white border-slate-200',
      icon: <Trophy className="w-6 h-6 text-slate-500" />,
      height: 'h-36',
      label: 'Hạng 2',
    },
    {
      wrapper: 'md:mt-14 bg-gradient-to-b from-orange-100 to-amber-50 border-orange-200',
      icon: <Medal className="w-6 h-6 text-orange-500" />,
      height: 'h-32',
      label: 'Hạng 3',
    },
  ];

  const nextAssignment = [...pendingAssignments].sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  })[0];

  const recentCompletedAssignments = [...completedAssignments].slice(0, 3);

  const getAssignedExamCodeForStudent = (assignment: Assignment, exam: Exam | undefined) => {
    if (!loggedInStudent || !exam) return { text: '', isLegacy: false };
    const versions = examVersionsByExamId[assignment.examId] || [];
    if (versions.length === 0) return { text: '', isLegacy: false };

    if (exam.templateType === 'LEGACY_PHIU_TRA_LOI') {
      const codes = versions.map(v => v.code).join(', ');
      return { text: `Các mã đề hợp lệ: ${codes}`, isLegacy: true };
    }

    if (assignment.mode !== 'EXAM') return { text: '', isLegacy: false };
    const selected = pickDeterministicExamVersion(versions, loggedInStudent.id, assignment.id);
    return { text: selected ? `Mã đề của em: ${selected.code}` : '', isLegacy: false };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 md:pb-8 safe-pb safe-pt relative selection:bg-emerald-100">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.08),_transparent_24%)] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-8 relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Chào, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">{loggedInStudent.fullName ? loggedInStudent.fullName.split(' ').pop() : 'bạn'}</span> 👋
            </h1>
            <p className="text-slate-500 text-sm mt-1">Lớp: {studentClass || 'Đang cập nhật'} | SBD: {loggedInStudent.sbd}</p>
          </div>
          <div className="hidden md:flex items-center gap-4">
             <button 
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
          </div>
        </div>

        {/* Main Content Area based on Tab (Mobile) or All (Desktop) */}
        <div className={cn("space-y-6", activeTab !== 'home' && "hidden md:block")}>
          {urgentNotStartedAssignments.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <strong>Cần vào làm bài ngay:</strong> Đã đến giờ cho {urgentNotStartedAssignments.length} bài nhưng em chưa vào tô đáp án.
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Bài cần làm</div>
              <div className="mt-3 text-3xl font-black text-slate-900">{pendingAssignments.length}</div>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đã hoàn thành</div>
              <div className="mt-3 text-3xl font-black text-slate-900">{completedAssignments.length}</div>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Điểm mới nhất</div>
              <div className="mt-3 text-3xl font-black text-emerald-600">{recentAttempt ? recentScore.toFixed(2) : '--'}</div>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider" title="Thứ hạng của bài thi mới nhất em tham gia">Hạng bài cuối</div>
              <div className="mt-3 text-3xl font-black text-slate-900">{latestRankText}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Bài cần làm ngay</h2>
                  <p className="text-sm text-slate-500 mt-1">Ưu tiên làm bài gần hạn trước.</p>
                </div>
                <Target className="w-5 h-5 text-emerald-600" />
              </div>

              {nextAssignment ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-md border",
                      nextAssignment.mode === 'EXAM'
                        ? "bg-rose-100 text-rose-600 border-rose-200"
                        : "bg-emerald-100 text-emerald-700 border-emerald-200"
                    )}>
                      {nextAssignment.mode === 'EXAM' ? 'THI ONLINE' : 'ÔN LUYỆN'}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Hạn: {nextAssignment.dueDate ? nextAssignment.dueDate.split('T')[0] : 'Không xác định'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{exams.find(e => e.id === nextAssignment.examId)?.title || 'Đề thi'}</h3>
                  {(() => {
                    const exam = exams.find(e => e.id === nextAssignment.examId);
                    const codeInfo = getAssignedExamCodeForStudent(nextAssignment, exam);
                    if (codeInfo.text) {
                      return (
                        <div className={cn(
                          "mt-2 text-xs font-bold inline-flex items-center px-2.5 py-1 rounded-lg border",
                          codeInfo.isLegacy ? "text-orange-700 bg-orange-100 border-orange-200" : "text-blue-700 bg-blue-100 border-blue-200"
                        )}>
                          {codeInfo.text}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <p className="mt-2 text-sm text-slate-600">Hoàn thành bài này để cải thiện điểm và giữ vững thứ hạng của em.</p>
                  <button
                    onClick={() => handleStartAssignment(nextAssignment)}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    {nextAssignment.mode === 'EXAM' ? <PlayCircle className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                    {nextAssignment.mode === 'EXAM' ? 'Bắt đầu thi' : 'Vào ôn luyện'}
                  </button>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  Em đã hoàn thành toàn bộ bài hiện có. Rất tốt!
                </div>
              )}
            </section>

            <section className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-6 text-white shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-emerald-50/80 text-xs font-bold uppercase tracking-[0.18em]">Top 3 lớp</p>
                  <h2 className="mt-2 text-xl font-black">Vinh danh học sinh nổi bật</h2>
                </div>
                <select 
                  className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 outline-none max-w-xs truncate"
                  value={selectedLeaderboardAssignmentId}
                  onChange={(e) => setSelectedLeaderboardAssignmentId(e.target.value)}
                >
                  <option value="" className="text-slate-900">-- Chọn đề thi --</option>
                  {Array.from(new Set(allAttempts.map(a => a.assignmentId))).map(assignmentId => {
                    const assign = assignments.find(a => a.id === assignmentId);
                    const exam = exams.find(e => e.id === assign?.examId);
                    return <option key={assignmentId} value={assignmentId} className="text-slate-900">{exam?.title || 'Bài tập ' + assignmentId.slice(0,4)}</option>;
                  })}
                </select>
              </div>

              {topThreeStudents.length === 0 ? (
                <div className="rounded-2xl bg-white/10 border border-white/20 px-4 py-8 text-center text-sm text-white/80">
                  Chưa có đủ dữ liệu để xếp hạng top 3.
                </div>
              ) : (
                <div className="space-y-3">
                  {topThreeStudents.map((entry, index) => (
                    <div key={entry.student.id} className="rounded-2xl bg-white/12 border border-white/20 px-4 py-3 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                          {index === 0 ? <Crown className="w-5 h-5 text-amber-200" /> : index === 1 ? <Trophy className="w-5 h-5 text-slate-100" /> : <Medal className="w-5 h-5 text-orange-200" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold truncate">{entry.student.fullName}</p>
                            {entry.student.id === loggedInStudent.id && (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Bạn</span>
                            )}
                          </div>
                          <p className="text-xs text-white/75">Top {index + 1} • {entry.score.toFixed(2)} điểm</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {recentCompletedAssignments.length > 0 && (
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Kết quả gần đây</h2>
                  <p className="text-sm text-slate-500 mt-1">Xem nhanh các bài em vừa hoàn thành.</p>
                </div>
                <Award className="w-5 h-5 text-teal-600" />
              </div>

              <div className="space-y-3">
                {recentCompletedAssignments.map((assignment) => {
                  const exam = exams.find(e => e.id === assignment.examId);
                  const studentAttempts = attempts.filter(att => att.assignmentId === assignment.id);
                  const bestAttempt = studentAttempts.reduce((best, current) => (current?.score || 0) > (best?.score || 0) ? current : best, studentAttempts[0]);

                  return (
                    <div key={assignment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div>
                        <p className="font-bold text-slate-900">{exam?.title || 'Đề thi'}</p>
                        <p className="text-sm text-slate-500">Điểm tốt nhất: {(bestAttempt?.score || 0).toFixed(1)}</p>
                      </div>
                      <button
                        onClick={() => navigate(`/exam/${assignment.id}?mode=REVIEW`)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 border border-slate-200 hover:bg-slate-100"
                      >
                        <Eye className="w-4 h-4" />
                        Xem chi tiết
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className={cn("space-y-6", activeTab !== 'tasks' && "hidden md:block")}>
          {/* Pending Assignments */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-600" />
              Nhiệm vụ cần làm ({pendingAssignments.length})
            </h2>
            
            <div className="space-y-3">
              {pendingAssignments.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center text-slate-500 text-sm">
                  Tuyệt vời! Em đã hoàn thành hết bài tập.
                </div>
              ) : (
                pendingAssignments.map(assignment => {
                  const exam = exams.find(e => e.id === assignment.examId);
                  const isUrgentNotStarted = urgentNotStartedAssignments.some(item => item.id === assignment.id);
                  
                  return (
                    <div key={assignment.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 hover:border-emerald-300 transition-all flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center group">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-md border",
                            assignment.mode === 'EXAM' 
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          )}>
                            {assignment.mode === 'EXAM' ? 'THI ONLINE' : 'ÔN LUYỆN'}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Hạn: {assignment.dueDate ? assignment.dueDate.split('T')[0] : 'Không xác định'}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 line-clamp-1">{exam?.title || 'Đề thi'}</h3>
                        {(() => {
                          const codeInfo = getAssignedExamCodeForStudent(assignment, exam);
                          if (codeInfo.text) {
                            return (
                              <div className={cn(
                                "mt-1 text-xs font-bold inline-flex items-center px-2 py-0.5 rounded-md border",
                                codeInfo.isLegacy ? "text-orange-700 bg-orange-100 border-orange-200" : "text-blue-700 bg-blue-100 border-blue-200"
                              )}>
                                {codeInfo.text}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {isUrgentNotStarted && (
                          <div className="mt-1 text-xs font-bold text-rose-600">Đã đến giờ nhưng em chưa vào làm.</div>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => handleStartAssignment(assignment)}
                        className={cn(
                          "shrink-0 px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all w-full sm:w-auto text-sm",
                          assignment.mode === 'EXAM' 
                            ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30" 
                            : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        )}
                      >
                        {assignment.mode === 'EXAM' ? <PlayCircle className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                        {assignment.mode === 'EXAM' ? 'Bắt đầu thi' : 'Vào ôn luyện'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Completed Assignments */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-teal-600" />
              Kết quả bài làm
            </h2>
            
            <div className="space-y-3">
              {completedAssignments.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center text-slate-500 text-sm">
                  Em chưa hoàn thành bài tập nào.
                </div>
              ) : (
                completedAssignments.map(assignment => {
                  const exam = exams.find(e => e.id === assignment.examId);
                  const studentAttempts = attempts.filter(att => att.assignmentId === assignment.id);
                  const bestAttempt = studentAttempts.reduce((best, current) => (current?.score || 0) > (best?.score || 0) ? current : best, studentAttempts[0]);
                  
                  return (
                    <div key={assignment.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center opacity-80 hover:opacity-100 transition-opacity">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-md border",
                            assignment.mode === 'EXAM' 
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          )}>
                            {assignment.mode === 'EXAM' ? 'THI ONLINE' : 'ÔN LUYỆN'}
                          </span>
                          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Hoàn thành
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 line-clamp-1">{exam?.title || 'Đề thi'}</h3>
                        {(() => {
                          const codeInfo = getAssignedExamCodeForStudent(assignment, exam);
                          if (codeInfo.text) {
                            return (
                              <div className={cn(
                                "mt-1 text-xs font-bold inline-flex items-center px-2 py-0.5 rounded-md border",
                                codeInfo.isLegacy ? "text-orange-700 bg-orange-100 border-orange-200" : "text-blue-700 bg-blue-100 border-blue-200"
                              )}>
                                {codeInfo.text}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 flex-1 sm:flex-none text-center">
                          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Điểm số</div>
                          <div className={cn(
                            "font-black text-lg",
                            (bestAttempt?.score || 0) >= 8 ? 'text-emerald-400' : (bestAttempt?.score || 0) >= 5 ? 'text-teal-400' : 'text-rose-400'
                          )}>
                            {(bestAttempt?.score || 0).toFixed(1)}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 flex-1 sm:flex-none">
                          <button 
                            onClick={() => navigate(`/exam/${assignment.id}?mode=REVIEW`)}
                            className="px-3 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                          >
                            <Eye className="w-3 h-3" /> Chi tiết
                          </button>
                          {(assignment.mode === 'PRACTICE' || (assignment.mode === 'EXAM' && studentAttempts.length < (assignment.maxAttempts || 1))) && (
                            <button 
                              onClick={() => handleStartAssignment(assignment)}
                              className="px-3 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
                            >
                              <PlayCircle className="w-3 h-3" /> Làm lại
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <div className={cn("space-y-6", activeTab !== 'profile' && "hidden md:block")}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-emerald-600" />
              Thông tin cá nhân
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Họ và tên</span>
                <span className="font-medium text-slate-900">{loggedInStudent.fullName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Số báo danh</span>
                <span className="font-medium text-slate-900">{loggedInStudent.sbd}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Lớp</span>
                <span className="font-medium text-slate-900">{studentClass}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Hạng bài thi vừa tham gia</span>
                <span className="font-medium text-emerald-600">{latestRankText}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full mt-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all md:hidden"
              >
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-pb bg-white/95 backdrop-blur-xl border-t border-slate-200">
        <div className="flex justify-around items-center p-2">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn("flex flex-col items-center p-2 w-16 transition-colors", activeTab === 'home' ? "text-emerald-600" : "text-slate-500")}
          >
            <Home className={cn("w-6 h-6 mb-1", activeTab === 'home' && "drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]")} />
            <span className="text-[10px] font-medium">Tổng quan</span>
          </button>
          <button 
            onClick={() => setActiveTab('tasks')}
            className={cn("flex flex-col items-center p-2 w-16 transition-colors relative", activeTab === 'tasks' ? "text-emerald-600" : "text-slate-500")}
          >
            <Target className={cn("w-6 h-6 mb-1", activeTab === 'tasks' && "drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]")} />
            {pendingAssignments.length > 0 && (
              <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
            )}
            <span className="text-[10px] font-medium">Bài tập</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn("flex flex-col items-center p-2 w-16 transition-colors", activeTab === 'profile' ? "text-emerald-600" : "text-slate-500")}
          >
            <UserIcon className={cn("w-6 h-6 mb-1", activeTab === 'profile' && "drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]")} />
            <span className="text-[10px] font-medium">Cá nhân</span>
          </button>
        </div>
      </div>

    </div>
  );
}
