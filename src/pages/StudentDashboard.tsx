import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, BookOpen, TrendingUp, Target, Award, Sparkles, LogIn, CheckCircle2, Eye, Clock, Home, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { store } from '@/lib/store';
import { Assignment, Attempt, Exam, Student, Class } from '@/types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
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
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [allAttempts, setAllAttempts] = useState<Attempt[]>([]);

  const [studentClass, setStudentClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'tasks' | 'profile'>('home');

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
    const unsubAssignments = store.subscribeToStudentAssignments(setAllAssignments, loggedInStudent.classId);
    const unsubAttempts = store.subscribeToClassAttempts(setAllAttempts, loggedInStudent.classId);

    return () => {
      if (unsubClasses) unsubClasses();
      if (unsubExams) unsubExams();
      if (unsubAssignments) unsubAssignments();
      if (unsubAttempts) unsubAttempts();
    };
  }, [loggedInStudent]);

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-400">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!loggedInStudent || !userProfile) {
    return <div className="p-8 text-center text-slate-400 bg-slate-950 min-h-screen">Không tìm thấy thông tin học sinh. Vui lòng đăng nhập lại.</div>;
  }

  const recentAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const recentScore = recentAttempt?.score || 0;

  const pendingAssignments = assignments.filter(a => !attempts.some(att => att.assignmentId === a.id));
  const completedAssignments = assignments.filter(a => attempts.some(att => att.assignmentId === a.id));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 md:pb-8 safe-pb safe-pt relative selection:bg-emerald-500/30">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-5 mix-blend-screen pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/80 pointer-events-none"></div>
      
      {/* Glowing Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-teal-400/10 rounded-full blur-[100px] animate-pulse delay-1000 pointer-events-none"></div>

      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-8 relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Chào, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">{loggedInStudent.fullName.split(' ').pop()}</span> 👋
            </h1>
            <p className="text-emerald-200/60 text-sm mt-1">Lớp: {studentClass || 'Đang cập nhật'} | SBD: {loggedInStudent.sbd}</p>
          </div>
          <div className="hidden md:flex items-center gap-4">
             <button 
                onClick={handleLogout}
                className="text-sm text-emerald-200/60 hover:text-emerald-400 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
          </div>
        </div>

        {/* Main Content Area based on Tab (Mobile) or All (Desktop) */}
        <div className={cn("space-y-6", activeTab !== 'home' && "hidden md:block")}>
          {/* AI Insight Card */}
          <div className="glass-card overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full"></div>
            <div className="p-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg mb-2 flex items-center gap-2">
                    Nhận xét từ AI
                  </h3>
                  {attempts.length > 0 ? (
                    <>
                      <p className="text-slate-300 leading-relaxed mb-3 text-sm">
                        Dựa trên bài làm gần nhất, em đạt <strong className="text-emerald-400">{recentScore.toFixed(2)}</strong> điểm. Hãy xem lại các câu sai để rút kinh nghiệm nhé.
                      </p>
                      <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-xl p-3 text-emerald-300 text-sm font-medium italic">
                        "Thầy tin em làm được! Hãy tiếp tục cố gắng ở các bài tập tiếp theo."
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-300 leading-relaxed text-sm">
                      Em chưa làm bài nào. Hãy bắt đầu làm các bài tập được giao bên dưới nhé!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-5 flex flex-col items-center justify-center text-center">
              <div className="text-emerald-200/60 text-xs font-bold uppercase tracking-wider mb-1">Điểm gần nhất</div>
              <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                {attempts.length > 0 ? recentScore.toFixed(1) : '--'}
              </div>
            </div>
            <div className="glass-card p-5 flex flex-col items-center justify-center text-center">
              <div className="text-emerald-200/60 text-xs font-bold uppercase tracking-wider mb-1">Đã hoàn thành</div>
              <div className="text-3xl font-black text-white">
                {attempts.length}
              </div>
            </div>
          </div>
        </div>

        <div className={cn("space-y-6", activeTab !== 'tasks' && "hidden md:block")}>
          {/* Pending Assignments */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              Nhiệm vụ cần làm ({pendingAssignments.length})
            </h2>
            
            <div className="space-y-3">
              {pendingAssignments.length === 0 ? (
                <div className="glass-card p-8 text-center text-slate-400 text-sm">
                  Tuyệt vời! Em đã hoàn thành hết bài tập.
                </div>
              ) : (
                pendingAssignments.map(assignment => {
                  const exam = exams.find(e => e.id === assignment.examId);
                  
                  return (
                    <div key={assignment.id} className="glass-card p-4 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center group">
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
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Hạn: {assignment.dueDate.split('T')[0]}
                          </span>
                        </div>
                        <h3 className="font-bold text-white line-clamp-1">{exam?.title || 'Đề thi'}</h3>
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
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-teal-400" />
              Kết quả bài làm
            </h2>
            
            <div className="space-y-3">
              {completedAssignments.length === 0 ? (
                <div className="glass-card p-8 text-center text-slate-400 text-sm">
                  Em chưa hoàn thành bài tập nào.
                </div>
              ) : (
                completedAssignments.map(assignment => {
                  const exam = exams.find(e => e.id === assignment.examId);
                  const studentAttempts = attempts.filter(att => att.assignmentId === assignment.id);
                  const bestAttempt = studentAttempts.reduce((best, current) => (current?.score || 0) > (best?.score || 0) ? current : best, studentAttempts[0]);
                  
                  return (
                    <div key={assignment.id} className="glass-card p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center opacity-80 hover:opacity-100 transition-opacity">
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
                        <h3 className="font-bold text-white line-clamp-1">{exam?.title || 'Đề thi'}</h3>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-700/50 flex-1 sm:flex-none text-center">
                          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Điểm số</div>
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
                            className="px-3 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
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
          <div className="glass-card p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-emerald-400" />
              Thông tin cá nhân
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Họ và tên</span>
                <span className="font-medium text-white">{loggedInStudent.fullName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Số báo danh</span>
                <span className="font-medium text-white">{loggedInStudent.sbd}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Lớp</span>
                <span className="font-medium text-white">{studentClass}</span>
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-pb bg-slate-950/80 backdrop-blur-xl border-t border-slate-800/50">
        <div className="flex justify-around items-center p-2">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn("flex flex-col items-center p-2 w-16 transition-colors", activeTab === 'home' ? "text-emerald-400" : "text-slate-500")}
          >
            <Home className={cn("w-6 h-6 mb-1", activeTab === 'home' && "drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]")} />
            <span className="text-[10px] font-medium">Tổng quan</span>
          </button>
          <button 
            onClick={() => setActiveTab('tasks')}
            className={cn("flex flex-col items-center p-2 w-16 transition-colors relative", activeTab === 'tasks' ? "text-emerald-400" : "text-slate-500")}
          >
            <Target className={cn("w-6 h-6 mb-1", activeTab === 'tasks' && "drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]")} />
            {pendingAssignments.length > 0 && (
              <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-950"></span>
            )}
            <span className="text-[10px] font-medium">Bài tập</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn("flex flex-col items-center p-2 w-16 transition-colors", activeTab === 'profile' ? "text-emerald-400" : "text-slate-500")}
          >
            <UserIcon className={cn("w-6 h-6 mb-1", activeTab === 'profile' && "drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]")} />
            <span className="text-[10px] font-medium">Cá nhân</span>
          </button>
        </div>
      </div>

    </div>
  );
}
