import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, BarChart3, Plus, Settings, BrainCircuit, Calendar, Clock, CheckCircle2, X, GraduationCap, Trash2, School, AlertCircle, LogOut, Edit3 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { store } from '@/lib/store';
import { Exam, Assignment, Attempt, Student, Class } from '@/types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EXAMS' | 'CLASSES' | 'STUDENTS' | 'RESULTS'>('OVERVIEW');
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // Assign Modal form state
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMode, setSelectedMode] = useState<'EXAM' | 'PRACTICE'>('EXAM');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Add Class Modal form state
  const [newClassName, setNewClassName] = useState('');

  // Filter state for students tab
  const [studentFilterClass, setStudentFilterClass] = useState<string>('ALL');

  // Results tab state
  const [selectedExamForResults, setSelectedExamForResults] = useState<string>('');
  const [selectedClassForResults, setSelectedClassForResults] = useState<string>('');

  // Custom Dialogs
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({isOpen: false, message: '', onConfirm: () => {}});
  const [alertDialog, setAlertDialog] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});

  useEffect(() => {
    if (!userProfile?.uid) return;

    if (userProfile.email === 'nvx@gmail.com') {
      store.migrateOldDataForTeacher(userProfile.uid).then(() => {
        console.log('Đã khôi phục dữ liệu cho nvx@gmail.com');
      });
    }

    const unsubClasses = store.subscribeToClasses((loadedClasses) => {
      setClasses(loadedClasses);
      if (loadedClasses.length > 0) {
        setSelectedClass(prev => prev || loadedClasses[0].id);
      }
    }, userProfile.uid);
    const unsubExams = store.subscribeToExams(setExams, userProfile.uid);
    const unsubAssignments = store.subscribeToAssignments(setAssignments, userProfile.uid);
    const unsubStudents = store.subscribeToStudents(setStudents, userProfile.uid);

    return () => {
      unsubClasses();
      unsubExams();
      unsubAssignments();
      unsubStudents();
    };
  }, [userProfile?.uid]);

  useEffect(() => {
    const assignmentIds = assignments.map(a => a.id);
    const unsubAttempts = store.subscribeToTeacherAttempts(setAttempts, assignmentIds);
    return () => unsubAttempts();
  }, [assignments]);

  const handleAddClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !userProfile?.uid) return;
    
    const newClass: Class = {
      id: Date.now().toString(),
      name: newClassName.trim(),
      teacherId: userProfile.uid,
      createdAt: Date.now()
    };
    
    await store.saveClass(newClass);
    const updatedClasses = await store.getClasses(userProfile.uid);
    setClasses(updatedClasses);
    setIsAddClassModalOpen(false);
    setNewClassName('');
    
    if (!selectedClass) setSelectedClass(newClass.id);
  };

  const handleDeleteClass = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      message: 'Bạn có chắc chắn muốn xóa lớp này? Các học sinh và bài tập thuộc lớp này có thể bị ảnh hưởng.',
      onConfirm: async () => {
        await store.deleteClass(id);
        const updatedClasses = await store.getClasses(userProfile?.uid);
        setClasses(updatedClasses);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteStudent = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      message: `Bạn có chắc chắn muốn xóa học sinh "${name}" khỏi hệ thống?`,
      onConfirm: async () => {
        await store.deleteStudent(id);
        const updatedStudents = await store.getStudents(userProfile?.uid);
        setStudents(updatedStudents);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteAttempt = (attemptId: string, studentName: string) => {
    setConfirmDialog({
      isOpen: true,
      message: `Bạn có chắc chắn muốn xóa bài làm của học sinh "${studentName}"?`,
      onConfirm: async () => {
        await store.deleteAttempt(attemptId);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId || !userProfile?.uid) {
      setAlertDialog({ isOpen: true, message: 'Vui lòng chọn đề thi' });
      return;
    }

    const newAssignment: Assignment = {
      id: Date.now().toString(),
      examId: selectedExamId,
      classId: selectedClass,
      teacherId: userProfile.uid,
      mode: selectedMode,
      status: 'PENDING',
      startDate: startDate || new Date().toISOString().slice(0, 16),
      dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      createdAt: Date.now()
    };

    await store.saveAssignment(newAssignment);
    const updatedAssignments = await store.getAssignments(userProfile.uid);
    setAssignments(updatedAssignments);
    setIsAssignModalOpen(false);
    
    setSelectedExamId('');
    setSelectedMode('EXAM');
    setStartDate('');
    setDueDate('');
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans safe-pt safe-pb relative selection:bg-emerald-500/30">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-5 mix-blend-screen pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/80 pointer-events-none"></div>
      
      {/* Glowing Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-teal-400/10 rounded-full blur-[100px] animate-pulse delay-1000 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-card p-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Quản lý Giảng dạy</h1>
            <p className="text-emerald-200/60 text-sm mt-1">Hệ thống Phiếu Trả Lời Trắc Nghiệm Thông Minh</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0">
            <button 
              onClick={() => setIsAssignModalOpen(true)}
              className="flex-1 md:flex-none justify-center bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors border border-emerald-500/30 text-sm"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Giao bài</span>
            </button>
            <button 
              onClick={() => navigate('/teacher/exam/new')}
              className="flex-1 md:flex-none justify-center bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tạo đề mới</span>
            </button>
            <button 
              onClick={handleLogout}
              className="flex-1 md:flex-none justify-center bg-slate-800/50 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors border border-slate-700/50 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
          {[
            { id: 'OVERVIEW', label: 'Tổng quan', icon: null },
            { id: 'EXAMS', label: 'Đề thi', icon: <FileText className="w-4 h-4" /> },
            { id: 'CLASSES', label: 'Lớp học', icon: <School className="w-4 h-4" /> },
            { id: 'STUDENTS', label: 'Học sinh', icon: <GraduationCap className="w-4 h-4" /> },
            { id: 'RESULTS', label: 'Kết quả', icon: <BarChart3 className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                activeTab === tab.id 
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                  : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'OVERVIEW' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-5 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 mb-3 border border-emerald-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-white">{exams.length}</div>
                <div className="text-xs text-emerald-200/60 font-bold uppercase tracking-wider mt-1">Đề thi</div>
              </div>
              <div className="glass-card p-5 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center text-teal-400 mb-3 border border-teal-500/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-white">{assignments.length}</div>
                <div className="text-xs text-emerald-200/60 font-bold uppercase tracking-wider mt-1">Lượt giao</div>
              </div>
              <div className="glass-card p-5 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 mb-3 border border-blue-500/30">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-white">{attempts.length}</div>
                <div className="text-xs text-emerald-200/60 font-bold uppercase tracking-wider mt-1">Nộp bài</div>
              </div>
              <div className="glass-card p-5 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 mb-3 border border-purple-500/30">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-white">{students.length}</div>
                <div className="text-xs text-emerald-200/60 font-bold uppercase tracking-wider mt-1">Học sinh</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Active Assignments */}
              <div className="lg:col-span-2 space-y-4">
                <div className="glass-card overflow-hidden">
                  <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-emerald-400" />
                      Bài tập đang giao
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {assignments.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm">
                        Chưa có bài tập nào được giao.
                      </div>
                    ) : (
                      assignments.map(assignment => {
                        const exam = exams.find(e => e.id === assignment.examId);
                        const classStudents = students.filter(s => s.classId === assignment.classId);
                        const totalStudents = classStudents.length || 1;
                        const completedCount = attempts.filter(a => a.assignmentId === assignment.id).length;
                        const progress = Math.min(100, Math.round((completedCount / totalStudents) * 100));

                        return (
                          <div key={assignment.id} className="p-5 hover:bg-slate-800/50 transition-colors">
                            <div className="flex justify-between items-start mb-4">
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
                                <h3 className="font-bold text-white">{exam?.title || 'Đề thi không xác định'}</h3>
                                <p className="text-xs text-emerald-200/60 mt-1">Lớp: {classes.find(c => c.id === assignment.classId)?.name || 'Lớp không xác định'}</p>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between text-xs mb-1.5">
                                <span className="text-slate-400 font-medium">Tiến độ nộp bài</span>
                                <span className="font-bold text-emerald-400">{completedCount}/{classStudents.length}</span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? 'bg-emerald-400' : 'bg-teal-500')}
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* AI Insights Sidebar */}
              <div className="space-y-4">
                <div className="glass-card p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
                  <div className="flex items-center gap-2 mb-5 relative z-10">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                      <BrainCircuit className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h2 className="text-base font-bold text-white">AI Phân tích</h2>
                  </div>

                  {attempts.length > 0 ? (
                    <div className="space-y-4 relative z-10">
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <h3 className="font-bold text-emerald-300 mb-2 text-xs uppercase tracking-wider">Cập nhật mới</h3>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          Đã có <strong className="text-white">{attempts.length}</strong> bài nộp mới. Hệ thống đang phân tích phổ điểm.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 text-sm py-4 relative z-10">
                      Chưa đủ dữ liệu để AI phân tích.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* EXAMS TAB */}
        {activeTab === 'EXAMS' && (
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-lg font-bold text-white">Đề thi đã tạo</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-900/80 text-emerald-200/60">
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Tên đề thi</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Ngày tạo</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {exams.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-500">Chưa có đề thi nào.</td>
                    </tr>
                  ) : (
                    exams.map(exam => (
                      <tr key={exam.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-bold text-white">{exam.title}</td>
                        <td className="p-4 text-slate-400">{new Date(exam.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td className="p-4 flex gap-2 justify-end">
                          <button 
                            onClick={() => navigate(`/teacher/exam/edit/${exam.id}`)}
                            className="p-2 text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CLASSES TAB */}
        {activeTab === 'CLASSES' && (
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-lg font-bold text-white">Danh sách Lớp học</h2>
              <button 
                onClick={() => setIsAddClassModalOpen(true)}
                className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors border border-emerald-500/30 text-xs"
              >
                <Plus className="w-3 h-3" /> Thêm lớp
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-900/80 text-emerald-200/60">
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Tên lớp</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Sĩ số</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-500">Chưa có lớp học nào.</td>
                    </tr>
                  ) : (
                    classes.map(cls => (
                      <tr key={cls.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <button 
                            onClick={() => { setStudentFilterClass(cls.id); setActiveTab('STUDENTS'); }}
                            className="font-bold text-emerald-400 hover:text-emerald-300 hover:underline"
                          >
                            {cls.name}
                          </button>
                        </td>
                        <td className="p-4 text-slate-300">{students.filter(s => s.classId === cls.id).length} học sinh</td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleDeleteClass(cls.id)}
                            className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors inline-flex"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'STUDENTS' && (
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/50">
              <h2 className="text-lg font-bold text-white">Học sinh</h2>
              <select 
                className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={studentFilterClass}
                onChange={(e) => setStudentFilterClass(e.target.value)}
              >
                <option value="ALL">Tất cả các lớp</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-900/80 text-emerald-200/60">
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">SBD</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Họ và tên</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Lớp</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {students.filter(s => studentFilterClass === 'ALL' || s.classId === studentFilterClass).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">Chưa có học sinh nào.</td>
                    </tr>
                  ) : (
                    students.filter(s => studentFilterClass === 'ALL' || s.classId === studentFilterClass).map(student => (
                      <tr key={student.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-emerald-400">{student.sbd}</td>
                        <td className="p-4 font-medium text-white">{student.fullName}</td>
                        <td className="p-4 text-slate-400">{classes.find(c => c.id === student.classId)?.name}</td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleDeleteStudent(student.id, student.fullName)}
                            className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors inline-flex"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RESULTS TAB */}
        {activeTab === 'RESULTS' && (
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-slate-700/50 flex flex-col gap-4 bg-slate-900/50">
              <h2 className="text-lg font-bold text-white">Bảng điểm</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <select 
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none flex-1"
                  value={selectedExamForResults}
                  onChange={(e) => { setSelectedExamForResults(e.target.value); setSelectedClassForResults(''); }}
                >
                  <option value="">-- Chọn bài tập --</option>
                  {Array.from(new Set(assignments.map(a => a.examId))).map(examId => {
                    const exam = exams.find(e => e.id === examId);
                    return <option key={examId} value={examId}>{exam?.title}</option>;
                  })}
                </select>
                {selectedExamForResults && (
                  <select 
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none flex-1"
                    value={selectedClassForResults}
                    onChange={(e) => setSelectedClassForResults(e.target.value)}
                  >
                    <option value="">-- Chọn lớp --</option>
                    {assignments.filter(a => a.examId === selectedExamForResults).map(a => {
                      const cls = classes.find(c => c.id === a.classId);
                      return <option key={a.classId} value={a.classId}>{cls?.name}</option>;
                    })}
                  </select>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {(!selectedExamForResults || !selectedClassForResults) ? (
                <div className="p-12 text-center text-slate-500">Vui lòng chọn bài tập và lớp.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-900/80 text-emerald-200/60">
                      <th className="p-4 font-bold uppercase tracking-wider text-xs text-center">Hạng</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs">Học sinh</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs text-center">Điểm</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {(() => {
                      const assignment = assignments.find(a => a.examId === selectedExamForResults && a.classId === selectedClassForResults);
                      if (!assignment) return <tr><td colSpan={4} className="p-8 text-center text-slate-500">Không tìm thấy bài tập.</td></tr>;

                      const assignmentAttempts = attempts.filter(a => a.assignmentId === assignment.id);
                      const studentBestAttempts = new Map<string, Attempt>();
                      assignmentAttempts.forEach(attempt => {
                        const existing = studentBestAttempts.get(attempt.studentId);
                        if (!existing || attempt.score > existing.score) studentBestAttempts.set(attempt.studentId, attempt);
                      });

                      const sortedAttempts = Array.from(studentBestAttempts.values()).sort((a, b) => b.score - a.score);
                      if (sortedAttempts.length === 0) return <tr><td colSpan={4} className="p-8 text-center text-slate-500">Chưa có bài nộp.</td></tr>;

                      let currentRank = 1, previousScore = -1;
                      return sortedAttempts.map((attempt, index) => {
                        if (attempt.score !== previousScore) currentRank = index + 1;
                        previousScore = attempt.score;
                        const student = students.find(s => s.id === attempt.studentId);
                        
                        return (
                          <tr key={attempt.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-4 text-center font-bold text-emerald-400">{currentRank}</td>
                            <td className="p-4">
                              <div className="font-bold text-white">{student?.fullName}</div>
                              <div className="text-xs text-slate-400 font-mono">{student?.sbd}</div>
                            </td>
                            <td className="p-4 text-center">
                              <span className={cn("font-bold text-lg", attempt.score >= 8 ? 'text-emerald-400' : attempt.score >= 5 ? 'text-teal-400' : 'text-rose-400')}>
                                {attempt.score.toFixed(1)}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => handleDeleteAttempt(attempt.id, student?.fullName || '')}
                                className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors inline-flex"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isAddClassModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Thêm Lớp học</h2>
              <button onClick={() => setIsAddClassModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddClassSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">Tên lớp</label>
                <input 
                  type="text" required placeholder="VD: Lớp 12A1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={newClassName} onChange={(e) => setNewClassName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddClassModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700">Hủy</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-500">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Giao bài mới</h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">Đề thi</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} required
                >
                  <option value="">-- Chọn đề thi --</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">Lớp</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} required
                >
                  <option value="">-- Chọn lớp --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Chế độ</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setSelectedMode('EXAM')} className={cn("p-3 rounded-xl border flex flex-col items-center gap-1", selectedMode === 'EXAM' ? "border-rose-500 bg-rose-500/10 text-rose-400" : "border-slate-700 text-slate-400")}>
                    <CheckCircle2 className="w-5 h-5" /> <span className="text-xs font-bold">Thi Online</span>
                  </button>
                  <button type="button" onClick={() => setSelectedMode('PRACTICE')} className={cn("p-3 rounded-xl border flex flex-col items-center gap-1", selectedMode === 'PRACTICE' ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-slate-700 text-slate-400")}>
                    <BrainCircuit className="w-5 h-5" /> <span className="text-xs font-bold">Ôn luyện</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Bắt đầu</label>
                  <input type="datetime-local" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Kết thúc</label>
                  <input type="datetime-local" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-bold bg-slate-800 text-slate-300">Hủy</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-500">Giao bài</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {alertDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-sm w-full">
            <AlertCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Thông báo</h3>
            <p className="text-slate-400 text-sm mb-5">{alertDialog.message}</p>
            <button onClick={() => setAlertDialog({ ...alertDialog, isOpen: false })} className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl">Đóng</button>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-sm w-full">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Xác nhận</h3>
            <p className="text-slate-400 text-sm mb-5">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl">Hủy</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl">Đồng ý</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
