import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, BarChart3, Plus, Settings, BrainCircuit, Calendar, Clock, CheckCircle2, X, GraduationCap, Trash2, School, AlertCircle, LogOut, Edit3, Target, Download, Eye } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { store } from '@/lib/store';
import { Exam, Assignment, Attempt, AttemptDraft, Student, Class } from '@/types';
import { exportAnswerKeyToWord, exportExamToWord, exportStudentAttemptToWord, exportMixedVersionsZip } from '@/lib/wordExport';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
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
  const [attemptDrafts, setAttemptDrafts] = useState<AttemptDraft[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [nowTs, setNowTs] = useState<number>(Date.now());

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
      if (unsubClasses) unsubClasses();
      if (unsubExams) unsubExams();
      if (unsubAssignments) unsubAssignments();
      if (unsubStudents) unsubStudents();
    };
  }, [userProfile?.uid]);

  useEffect(() => {
    const assignmentIds = assignments.map(a => a.id);
    const unsubAttempts = store.subscribeToTeacherAttempts(setAttempts, assignmentIds);
    const unsubDrafts = store.subscribeToTeacherAttemptDrafts(setAttemptDrafts, assignmentIds);
    return () => {
      if (unsubAttempts) unsubAttempts();
      if (unsubDrafts) unsubDrafts();
    };
  }, [assignments]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

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

    const selectedExam = exams.find(exam => exam.id === selectedExamId);
    if (!selectedExam) {
      setAlertDialog({ isOpen: true, message: 'Không tìm thấy đề thi được chọn.' });
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
      maxAttempts: selectedExam.onlineSettings?.maxAttempts || 1,
      examStatusSnapshot: selectedExam.status || 'DRAFT',
      titleSnapshot: selectedExam.title,
      subjectSnapshot: selectedExam.subject || '',
      durationMinutesSnapshot: selectedExam.onlineSettings?.durationMinutes || 50,
      showScoreImmediately: selectedExam.onlineSettings?.showScoreImmediately ?? true,
      showAnswersAfterSubmit: selectedExam.onlineSettings?.showAnswersAfterSubmit ?? false,
      passwordRequired: selectedExam.onlineSettings?.requirePassword ?? false,
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

  const handleChangeExamStatus = async (exam: Exam, nextStatus: Exam['status']) => {
    await store.saveExam({
      ...exam,
      status: nextStatus || 'DRAFT',
      updatedAt: Date.now(),
    });
  };

  const handleDeleteExam = (exam: Exam) => {
    setConfirmDialog({
      isOpen: true,
      message: `Bạn có chắc chắn muốn xóa đề "${exam.title}"? Đề sẽ được ẩn khỏi danh sách nhưng không xóa cứng dữ liệu.`,
      onConfirm: async () => {
        await store.softDeleteExam(exam.id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleExportExam = (exam: Exam) => {
    try {
      exportExamToWord(exam);
    } catch (error) {
      console.error(error);
      setAlertDialog({ isOpen: true, message: 'Không thể xuất file đề thi. Vui lòng thử lại.' });
    }
  };

  const handleExportAnswerKey = async (exam: Exam) => {
    try {
      // Với phiếu in giấy (LEGACY_PHIU_TRA_LOI): đáp án nằm trong từng ExamVersion đã lưu
      if (exam.templateType === 'LEGACY_PHIU_TRA_LOI') {
        const versions = await store.getExamVersions(exam.id);
        if (versions.length > 0) {
          // Kiểm tra có vờÉn nào có đáp án không
          const hasAnyAnswers = versions.some(v => {
            const p1 = Object.values(v.derivedExam.part1 || {}).some((q: any) => q?.answer);
            const p2 = Object.values(v.derivedExam.part2 || {}).some((q: any) => Object.keys(q?.answers || {}).length > 0);
            const p3 = Object.values(v.derivedExam.part3 || {}).some((q: any) => q?.answer);
            return p1 || p2 || p3;
          });
          if (!hasAnyAnswers) {
            setAlertDialog({ isOpen: true, message: `Đề "${exam.title}" đã có ${versions.length} mã phiếu nhưng chưa có đáp án nào được nhập. Hãy vào trang "Trộn đề" để nhập đáp án trước.` });
            return;
          }
          // Xuất ZIP chứa đề + đáp án từng mã (1 file ZIP duy nhất)
          await exportMixedVersionsZip({ originalExam: exam, versions });
          return;
        }
        // Fallback: chưa có mã phiếu nào được tạo
        setAlertDialog({ isOpen: true, message: `Đề "${exam.title}" chưa có mã phiếu nào. Hãy vào trang "Trộn đề" để tạo mã phiếu và nhập đáp án.` });
        return;
      }
      // Đề online thường: xuất đáp án của đề gốc
      exportAnswerKeyToWord(exam);
    } catch (error) {
      console.error(error);
      setAlertDialog({ isOpen: true, message: 'Không thể xuất file đáp án. Vui lòng thử lại.' });
    }
  };

  const handleExportStudentAttempt = async (attempt: Attempt) => {
    let exam = exams.find((item) => item.id === selectedExamForResults);
    const student = students.find((item) => item.id === attempt.studentId);
    const assignment = assignments.find((item) => item.id === attempt.assignmentId);
    const className = classes.find((item) => item.id === attempt.classId)?.name || classes.find((item) => item.id === selectedClassForResults)?.name;

    if (!exam) {
      setAlertDialog({ isOpen: true, message: 'Không tìm thấy đề thi để xuất bài làm.' });
      return;
    }

    if (exam.templateType === 'LEGACY_PHIU_TRA_LOI' && attempt.examVersionId) {
      try {
        const versions = await store.getExamVersions(exam.id);
        const version = versions.find(v => v.id === attempt.examVersionId);
        if (version) {
          exam = { 
            ...exam, 
            part1: version.derivedExam.part1 || {}, 
            part2: version.derivedExam.part2 || {}, 
            part3: version.derivedExam.part3 || {} 
          };
        }
      } catch (err) {
        console.error("Failed to load exam version for export:", err);
      }
    }

    try {
      exportStudentAttemptToWord({
        exam,
        attempt,
        student,
        assignment,
        className,
      });
    } catch (error) {
      console.error(error);
      setAlertDialog({ isOpen: true, message: 'Không thể xuất bài làm của học sinh. Vui lòng thử lại.' });
    }
  };

  const renderExamActionButtons = (exam: Exam, isMobileCard = false) => (
    <div className={cn(
      "flex gap-2",
      isMobileCard ? "flex-col" : "flex-col items-end"
    )}>
      <div className={cn(
        "flex flex-wrap gap-2",
        isMobileCard ? "justify-start" : "justify-end"
      )}>
        <button
          onClick={() => handleExportExam(exam)}
          className="px-3 py-2 text-xs font-bold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 inline-flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất đề
        </button>
        <button
          onClick={() => handleExportAnswerKey(exam)}
          className="px-3 py-2 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 inline-flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất đáp án
        </button>
      </div>
      <div className={cn(
        "flex flex-wrap gap-2",
        isMobileCard ? "justify-start" : "justify-end"
      )}>
        <button
          onClick={() => navigate(`/teacher/exam/view/${exam.id}`)}
          className="px-3 py-2 text-xs font-bold rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 inline-flex items-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          Xem đề
        </button>
        <button
          onClick={() => handleChangeExamStatus(exam, exam.status === 'PUBLISHED' ? 'LOCKED' : 'PUBLISHED')}
          className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          {exam.status === 'PUBLISHED' ? 'Khóa đề' : 'Xuất bản'}
        </button>
        <button
          onClick={() => navigate(
            exam.templateType === 'LEGACY_PHIU_TRA_LOI'
              ? `/teacher/sheet/mix/${exam.id}`
              : `/teacher/exam/mix/${exam.id}`
          )}
          className={cn(
            "px-3 py-2 text-xs font-bold rounded-lg border inline-flex items-center gap-1.5",
            exam.templateType === 'LEGACY_PHIU_TRA_LOI'
              ? "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100"
              : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          )}
          title={exam.templateType === 'LEGACY_PHIU_TRA_LOI' ? 'Xem/Nhập đáp án cho từng mã đề 4 số' : 'Trộn đề online'}
        >
          {exam.templateType === 'LEGACY_PHIU_TRA_LOI' ? '📋 Đáp án mã đề' : 'Trộn đề'}
        </button>
        <button 
          onClick={() => navigate(
            exam.templateType === 'LEGACY_PHIU_TRA_LOI'
              ? `/teacher/sheet/edit/${exam.id}`
              : `/teacher/exam/edit/${exam.id}`
          )}
          className="p-2 text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
          title={exam.templateType === 'LEGACY_PHIU_TRA_LOI' ? 'Sửa câu hỏi đề gốc (không phải đáp án mã đề)' : 'Sửa đề'}
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleDeleteExam(exam)}
          className="p-2 text-rose-400 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 transition-colors border border-rose-500/20"
          title="Xóa đề"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans safe-pt safe-pb relative selection:bg-emerald-100">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.08),_transparent_24%)] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quản lý Giảng dạy</h1>
            <p className="text-slate-500 text-sm mt-1">Hệ thống Phiếu Trả Lời Trắc Nghiệm Thông Minh</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0">
            <button 
              onClick={() => setIsAssignModalOpen(true)}
              className="flex-1 md:flex-none justify-center bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors border border-emerald-200 text-sm"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Giao bài</span>
            </button>
            <button 
              onClick={() => navigate('/teacher/exam/new')}
              className="flex-1 md:flex-none justify-center bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tạo đề online</span>
            </button>
            <button 
              onClick={() => navigate('/teacher/sheet/new')}
              className="flex-1 md:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(59,130,246,0.25)] text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tạo phiếu in giấy</span>
            </button>
            <button 
              onClick={handleLogout}
              className="flex-1 md:flex-none justify-center bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors border border-slate-200 text-sm"
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
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm" 
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
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
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-3 border border-emerald-200">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-slate-900">{exams.length}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Đề thi</div>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-3 border border-teal-200">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-slate-900">{assignments.length}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Lượt giao</div>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3 border border-blue-200">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-slate-900">{attempts.length}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Nộp bài</div>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-3 border border-purple-200">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-3xl font-black text-slate-900">{students.length}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Học sinh</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Active Assignments */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Target className="w-5 h-5 text-emerald-600" />
                      Bài tập đang giao
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {assignments.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-sm">
                        Chưa có bài tập nào được giao.
                      </div>
                    ) : (
                      assignments.map(assignment => {
                        const exam = exams.find(e => e.id === assignment.examId);
                        const classStudents = students.filter(s => s.classId === assignment.classId);
                        const totalStudents = classStudents.length || 1;
                        const completedCount = attempts.filter(a => a.assignmentId === assignment.id).length;
                        const progress = Math.min(100, Math.round((completedCount / totalStudents) * 100));
                        const startedStudentIds = new Set<string>([
                          ...attempts.filter(a => a.assignmentId === assignment.id).map(a => a.studentId),
                          ...attemptDrafts.filter(d => d.assignmentId === assignment.id).map(d => d.studentId),
                        ]);
                        const notStartedStudents = classStudents.filter(student => !startedStudentIds.has(student.id));
                        const hasReachedStartTime = assignment.startDate ? new Date(assignment.startDate).getTime() <= nowTs : true;

                        return (
                          <div key={assignment.id} className="p-5 hover:bg-slate-50 transition-colors">
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
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Hạn: {assignment.dueDate ? assignment.dueDate.split('T')[0] : 'Không xác định'}
                                  </span>
                                </div>
                                <h3 className="font-bold text-slate-900">{exam?.title || 'Đề thi không xác định'}</h3>
                                <p className="text-xs text-slate-500 mt-1">Lớp: {classes.find(c => c.id === assignment.classId)?.name || 'Lớp không xác định'}</p>
                                {hasReachedStartTime && notStartedStudents.length > 0 && (
                                  <div className="mt-1">
                                    <p className="text-xs font-bold text-rose-600">
                                      Trạng thái: {notStartedStudents.length} em chưa vào làm
                                    </p>
                                    <p className="text-[11px] text-rose-500">
                                      {notStartedStudents.slice(0, 3).map(s => s.fullName).join(', ')}
                                      {notStartedStudents.length > 3 ? '...' : ''}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between text-xs mb-1.5">
                                <span className="text-slate-500 font-medium">Tiến độ nộp bài</span>
                                <span className="font-bold text-emerald-600">{completedCount}/{classStudents.length}</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? 'bg-emerald-500' : 'bg-teal-500')}
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
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 blur-3xl rounded-full"></div>
                  <div className="flex items-center gap-2 mb-5 relative z-10">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-200">
                      <BrainCircuit className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h2 className="text-base font-bold text-slate-900">AI Phân tích</h2>
                  </div>

                  {attempts.length > 0 ? (
                    <div className="space-y-4 relative z-10">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-emerald-700 mb-2 text-xs uppercase tracking-wider">Cập nhật mới</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          Đã có <strong className="text-slate-900">{attempts.length}</strong> bài nộp mới. Hệ thống đang phân tích phổ điểm.
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Quản lý đề</h2>
                <p className="text-xs text-slate-500 mt-1">Danh sách các đề đang có trong hệ thống.</p>
              </div>
            </div>
            <div className="md:hidden divide-y divide-slate-200">
              {exams.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">Chưa có đề thi nào.</div>
              ) : (
                exams.map(exam => (
                  <div key={exam.id} className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 text-base leading-snug">{exam.title}</div>
                        <div className="text-sm text-slate-500 mt-1">
                          {exam.subject || 'Chưa chọn môn'}{exam.grade ? ` • ${exam.grade}` : ''}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 shrink-0">
                        {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString('vi-VN') : 'Không xác định'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                        {exam.status || 'DRAFT'}
                      </span>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        exam.templateType === 'ONLINE_EXAM'
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-blue-700"
                      )}>
                        {exam.templateType === 'ONLINE_EXAM' ? 'Đề thi đầy đủ' : 'Phiếu đáp án'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                        {exam.onlineSettings?.durationMinutes || 50} phút
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700">
                        {exam.onlineSettings?.maxAttempts || 1} lần
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      {renderExamActionButtons(exam, true)}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Tên đề thi</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Cấu hình</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Ngày tạo</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {exams.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">Chưa có đề thi nào.</td>
                    </tr>
                  ) : (
                    exams.map(exam => (
                      <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{exam.title}</div>
                          <div className="text-xs text-slate-500 mt-1">{exam.subject || 'Chưa chọn môn'}{exam.grade ? ` • ${exam.grade}` : ''}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                              {exam.status || 'DRAFT'}
                            </span>
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              exam.templateType === 'ONLINE_EXAM'
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-blue-50 text-blue-700"
                            )}>
                              {exam.templateType === 'ONLINE_EXAM' ? 'Đề thi đầy đủ' : 'Phiếu đáp án'}
                            </span>
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                              {exam.onlineSettings?.durationMinutes || 50} phút
                            </span>
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700">
                              {exam.onlineSettings?.maxAttempts || 1} lần
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-400">{exam.createdAt ? new Date(exam.createdAt).toLocaleDateString('vi-VN') : 'Không xác định'}</td>
                        <td className="p-4">
                          <div className="min-w-[280px]">
                            {renderExamActionButtons(exam)}
                          </div>
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">Danh sách Lớp học</h2>
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
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Tên lớp</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Sĩ số</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-500">Chưa có lớp học nào.</td>
                    </tr>
                  ) : (
                    classes.map(cls => (
                      <tr key={cls.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <button 
                            onClick={() => { setStudentFilterClass(cls.id); setActiveTab('STUDENTS'); }}
                            className="font-bold text-emerald-400 hover:text-emerald-300 hover:underline"
                          >
                            {cls.name}
                          </button>
                        </td>
                        <td className="p-4 text-slate-600">{students.filter(s => s.classId === cls.id).length} học sinh</td>
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">Học sinh</h2>
              <select 
                className="bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
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
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">SBD</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Họ và tên</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Lớp</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students.filter(s => studentFilterClass === 'ALL' || s.classId === studentFilterClass).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">Chưa có học sinh nào.</td>
                    </tr>
                  ) : (
                    students
                      .filter(s => studentFilterClass === 'ALL' || s.classId === studentFilterClass)
                      .sort((a, b) => a.sbd.localeCompare(b.sbd))
                      .map(student => (
                      <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-mono font-bold text-emerald-400">{student.sbd}</td>
                        <td className="p-4 font-medium text-slate-900">{student.fullName}</td>
                        <td className="p-4 text-slate-500">{classes.find(c => c.id === student.classId)?.name}</td>
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col gap-4 bg-slate-50">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">Bảng điểm</h2>
                {selectedExamForResults && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const exam = exams.find((item) => item.id === selectedExamForResults);
                        if (!exam) {
                          setAlertDialog({ isOpen: true, message: 'Không tìm thấy đề thi để xuất.' });
                          return;
                        }
                        handleExportExam(exam);
                      }}
                      className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Xuất đề
                    </button>
                    <button
                      onClick={() => {
                        const exam = exams.find((item) => item.id === selectedExamForResults);
                        if (!exam) {
                          setAlertDialog({ isOpen: true, message: 'Không tìm thấy đáp án để xuất.' });
                          return;
                        }
                        handleExportAnswerKey(exam);
                      }}
                      className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 border border-blue-200 inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Xuất đáp án
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select 
                  className="bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none flex-1"
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
                    className="bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none flex-1"
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
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="p-4 font-bold uppercase tracking-wider text-xs text-center">Hạng</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs">Học sinh</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs text-center">Điểm</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(() => {
                      const assignment = assignments.find(a => a.examId === selectedExamForResults && a.classId === selectedClassForResults);
                      if (!assignment) return <tr><td colSpan={4} className="p-8 text-center text-slate-500">Không tìm thấy bài tập.</td></tr>;

                      const assignmentAttempts = attempts.filter(a => a.assignmentId === assignment.id);
                      const studentBestAttempts = new Map<string, Attempt>();
                      assignmentAttempts.forEach(attempt => {
                        const existing = studentBestAttempts.get(attempt.studentId);
                        if (!existing || (attempt.score || 0) > (existing.score || 0)) studentBestAttempts.set(attempt.studentId, attempt);
                      });

                      const sortedAttempts = Array.from(studentBestAttempts.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
                      if (sortedAttempts.length === 0) return <tr><td colSpan={4} className="p-8 text-center text-slate-500">Chưa có bài nộp.</td></tr>;

                      return sortedAttempts.map((attempt, index) => {
                        const currentRank = index + 1;
                        const student = students.find(s => s.id === attempt.studentId);
                        
                        return (
                          <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-center font-bold text-emerald-400">{currentRank}</td>
                            <td className="p-4">
                              <div className="font-bold text-slate-900">{student?.fullName}</div>
                              <div className="text-xs text-slate-500 font-mono">{student?.sbd}</div>
                            </td>
                            <td className="p-4 text-center">
                              <span className={cn("font-bold text-lg", (attempt.score || 0) >= 8 ? 'text-emerald-400' : (attempt.score || 0) >= 5 ? 'text-teal-400' : 'text-rose-400')}>
                                {(attempt.score || 0).toFixed(1)}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleExportStudentAttempt(attempt)}
                                  className="px-3 py-2 text-xs font-bold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 inline-flex items-center gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Xuất bài làm
                                </button>
                                <button 
                                  onClick={() => handleDeleteAttempt(attempt.id, student?.fullName || '')}
                                  className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors inline-flex"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Thêm Lớp học</h2>
              <button onClick={() => setIsAddClassModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddClassSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tên lớp</label>
                <input 
                  type="text" required placeholder="VD: Lớp 12A1"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={newClassName} onChange={(e) => setNewClassName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddClassModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Hủy</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-500">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Giao bài mới</h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Đề thi</label>
                <select 
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} required
                >
                  <option value="">-- Chọn đề thi --</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Lớp</label>
                <select 
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} required
                >
                  <option value="">-- Chọn lớp --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Chế độ</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setSelectedMode('EXAM')} className={cn("p-3 rounded-xl border flex flex-col items-center gap-1", selectedMode === 'EXAM' ? "border-rose-300 bg-rose-50 text-rose-600" : "border-slate-300 text-slate-500 bg-white")}>
                    <CheckCircle2 className="w-5 h-5" /> <span className="text-xs font-bold">Thi Online</span>
                  </button>
                  <button type="button" onClick={() => setSelectedMode('PRACTICE')} className={cn("p-3 rounded-xl border flex flex-col items-center gap-1", selectedMode === 'PRACTICE' ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "border-slate-300 text-slate-500 bg-white")}>
                    <BrainCircuit className="w-5 h-5" /> <span className="text-xs font-bold">Ôn luyện</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Bắt đầu</label>
                  <input type="datetime-local" className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-sm outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Kết thúc</label>
                  <input type="datetime-local" className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-sm outline-none" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-bold bg-slate-100 text-slate-700">Hủy</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-500">Giao bài</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {alertDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center max-w-sm w-full shadow-xl">
            <AlertCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Thông báo</h3>
            <p className="text-slate-600 text-sm mb-5">{alertDialog.message}</p>
            <button onClick={() => setAlertDialog({ ...alertDialog, isOpen: false })} className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl">Đóng</button>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center max-w-sm w-full shadow-xl">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Xác nhận</h3>
            <p className="text-slate-600 text-sm mb-5">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl">Hủy</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl">Đồng ý</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
