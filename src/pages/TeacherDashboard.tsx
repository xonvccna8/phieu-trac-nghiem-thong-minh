import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, BarChart3, Plus, Settings, BrainCircuit, Calendar, Clock, CheckCircle2, X, GraduationCap, Trash2, School, AlertCircle, LogOut, Edit3 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { store } from '@/lib/store';
import { Exam, Assignment, Attempt, Student, Class } from '@/types';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EXAMS' | 'CLASSES' | 'STUDENTS' | 'RESULTS'>('OVERVIEW');
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
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

  // Add Student Modal form state - Removed
  // const [studentSbd, setStudentSbd] = useState('');
  // const [studentName, setStudentName] = useState('');
  // const [studentClass, setStudentClass] = useState('');

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

    // Tự động khôi phục dữ liệu cũ cho tài khoản nvx@gmail.com
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
    // Only subscribe to attempts for the teacher's assignments
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
        // updatedAttempts will be handled by subscription
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
      dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // Default 7 days
      createdAt: Date.now()
    };

    await store.saveAssignment(newAssignment);
    const updatedAssignments = await store.getAssignments(userProfile.uid);
    setAssignments(updatedAssignments); // Refresh list
    setIsAssignModalOpen(false);
    
    // Reset form
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Quản lý Giảng dạy</h1>
            <p className="text-gray-500">Hệ thống Phiếu Trả Lời Trắc Nghiệm Thông Minh</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto mt-4 md:mt-0">
            <button 
              onClick={() => setIsAssignModalOpen(true)}
              className="flex-1 md:flex-none justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Calendar className="w-5 h-5" />
              <span className="hidden sm:inline">Giao bài</span>
            </button>
            <button 
              onClick={() => navigate('/teacher/exam/new')}
              className="flex-1 md:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Tạo đề mới</span>
            </button>
            <button 
              onClick={handleLogout}
              className="flex-1 md:flex-none justify-center bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors border border-gray-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`pb-3 px-2 font-bold text-base md:text-lg transition-colors border-b-2 ${
              activeTab === 'OVERVIEW' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tổng quan
          </button>
          <button
            onClick={() => setActiveTab('EXAMS')}
            className={`pb-3 px-2 font-bold text-base md:text-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'EXAMS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-5 h-5 hidden sm:block" />
            Quản lý Đề thi
          </button>
          <button
            onClick={() => setActiveTab('CLASSES')}
            className={`pb-3 px-2 font-bold text-base md:text-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'CLASSES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <School className="w-5 h-5 hidden sm:block" />
            Quản lý Lớp học
          </button>
          <button
            onClick={() => setActiveTab('STUDENTS')}
            className={`pb-3 px-2 font-bold text-base md:text-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'STUDENTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <GraduationCap className="w-5 h-5 hidden sm:block" />
            Quản lý Học sinh
          </button>
          <button
            onClick={() => setActiveTab('RESULTS')}
            className={`pb-3 px-2 font-bold text-base md:text-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'RESULTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-5 h-5 hidden sm:block" />
            Bảng điểm & Xếp hạng
          </button>
        </div>

        {activeTab === 'OVERVIEW' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-800">{exams.length}</div>
                  <div className="text-sm text-gray-500 font-medium">Đề thi đã tạo</div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-800">{assignments.length}</div>
                  <div className="text-sm text-gray-500 font-medium">Lượt giao bài</div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-800">{attempts.length}</div>
                  <div className="text-sm text-gray-500 font-medium">Lượt nộp bài</div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-800">{students.length}</div>
                  <div className="text-sm text-gray-500 font-medium">Học sinh</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Active Assignments */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">Bài tập đang giao</h2>
                    <button className="text-blue-600 text-sm font-medium hover:underline">Xem tất cả</button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {assignments.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        Chưa có bài tập nào được giao.
                      </div>
                    ) : (
                      assignments.map(assignment => {
                        const exam = exams.find(e => e.id === assignment.examId);
                        // Calculate progress based on students in the assigned class
                        const classStudents = students.filter(s => s.classId === assignment.classId);
                        const totalStudents = classStudents.length || 1; // Avoid division by zero
                        const completedCount = attempts.filter(a => a.assignmentId === assignment.id).length;
                        const progress = Math.min(100, Math.round((completedCount / totalStudents) * 100));

                        return (
                          <div key={assignment.id} className="p-6 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                                    assignment.mode === 'EXAM' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {assignment.mode === 'EXAM' ? 'THI ONLINE' : 'ÔN LUYỆN'}
                                  </span>
                                  <span className="text-sm text-gray-500 font-medium flex items-center gap-1">
                                    <Clock className="w-4 h-4" /> {assignment.startDate ? `Từ: ${assignment.startDate.replace('T', ' ')} - ` : ''}Hạn: {assignment.dueDate.replace('T', ' ')}
                                  </span>
                                </div>
                                <h3 className="font-bold text-gray-800">{exam?.title || 'Đề thi không xác định'}</h3>
                                <p className="text-sm text-gray-500">Lớp: {classes.find(c => c.id === assignment.classId)?.name || 'Lớp không xác định'}</p>
                              </div>
                              <button className="text-gray-400 hover:text-blue-600">
                                <Settings className="w-5 h-5" />
                              </button>
                            </div>
                            
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600 font-medium">Tiến độ nộp bài</span>
                                <span className="font-bold text-gray-800">{completedCount}/{classStudents.length} học sinh</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
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
              <div className="space-y-6">
                <div className="bg-gradient-to-b from-indigo-50 to-white rounded-2xl shadow-sm border border-indigo-100 p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <BrainCircuit className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-indigo-900">AI Phân tích lớp học</h2>
                  </div>

                  {attempts.length > 0 ? (
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-2 text-sm">Cập nhật từ AI</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Đã có {attempts.length} bài nộp mới. Hệ thống đang phân tích phổ điểm và sẽ đưa ra gợi ý sớm nhất.
                        </p>
                      </div>
                      <button className="w-full py-2.5 bg-indigo-100 text-indigo-700 font-bold rounded-lg text-sm hover:bg-indigo-200 transition-colors">
                        Xem báo cáo chi tiết
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 text-sm py-4">
                      Chưa đủ dữ liệu để AI phân tích. Hãy đợi học sinh nộp bài.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'EXAMS' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">Danh sách Đề thi đã tạo</h2>
              <button 
                onClick={() => navigate('/teacher/exam/new')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Tạo đề mới
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-500 text-sm">
                    <th className="p-4 font-medium">Tên đề thi</th>
                    <th className="p-4 font-medium">Ngày tạo</th>
                    <th className="p-4 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {exams.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-500">
                        Chưa có đề thi nào. Hãy tạo đề thi đầu tiên của bạn!
                      </td>
                    </tr>
                  ) : (
                    exams.map(exam => (
                      <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-800">{exam.title}</td>
                        <td className="p-4 text-sm text-gray-500">
                          {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="p-4 flex gap-2 justify-end">
                          <button 
                            onClick={() => navigate(`/teacher/exam/edit/${exam.id}`)}
                            className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Sửa đề thi"
                          >
                            <Edit3 className="w-5 h-5" />
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

        {activeTab === 'CLASSES' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">Danh sách Lớp học</h2>
              <button 
                onClick={() => setIsAddClassModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Thêm lớp học
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                    <th className="p-4 font-bold">Tên lớp</th>
                    <th className="p-4 font-bold">Sĩ số</th>
                    <th className="p-4 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-500">
                        Chưa có lớp học nào. Hãy tạo lớp học đầu tiên.
                      </td>
                    </tr>
                  ) : (
                    classes.map(cls => (
                      <tr key={cls.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <button 
                            onClick={() => {
                              setStudentFilterClass(cls.id);
                              setActiveTab('STUDENTS');
                            }}
                            className="font-bold text-blue-600 hover:text-blue-800 hover:underline text-left"
                          >
                            {cls.name}
                          </button>
                        </td>
                        <td className="p-4 text-gray-600">
                          {students.filter(s => s.classId === cls.id).length} học sinh
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleDeleteClass(cls.id)}
                            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Xóa lớp học"
                          >
                            <Trash2 className="w-5 h-5" />
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

        {activeTab === 'STUDENTS' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Danh sách Học sinh</h2>
                <div className="text-sm text-gray-500">Học sinh tự đăng ký tài khoản</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Lọc theo lớp:</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={studentFilterClass}
                  onChange={(e) => setStudentFilterClass(e.target.value)}
                >
                  <option value="ALL">Tất cả các lớp</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                    <th className="p-4 font-bold">Số báo danh</th>
                    <th className="p-4 font-bold">Họ và tên</th>
                    <th className="p-4 font-bold">Lớp</th>
                    <th className="p-4 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.filter(s => studentFilterClass === 'ALL' || s.classId === studentFilterClass).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        Chưa có học sinh nào trong danh sách này.
                      </td>
                    </tr>
                  ) : (
                    students.filter(s => studentFilterClass === 'ALL' || s.classId === studentFilterClass).map(student => (
                      <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-blue-600">{student.sbd}</td>
                        <td className="p-4 font-medium text-gray-800">{student.fullName}</td>
                        <td className="p-4">
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm font-bold">
                            {classes.find(c => c.id === student.classId)?.name || 'Lớp không xác định'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleDeleteStudent(student.id, student.fullName)}
                            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Xóa học sinh"
                          >
                            <Trash2 className="w-5 h-5" />
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
        {activeTab === 'RESULTS' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Bảng điểm & Xếp hạng</h2>
                <div className="text-sm text-gray-500">Xem kết quả thi của học sinh theo từng bài tập đã giao</div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Chọn bài tập:</label>
                  <select 
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white w-full sm:w-48"
                    value={selectedExamForResults}
                    onChange={(e) => {
                      setSelectedExamForResults(e.target.value);
                      setSelectedClassForResults(''); // Reset class when exam changes
                    }}
                  >
                    <option value="">-- Chọn bài tập --</option>
                    {Array.from(new Set(assignments.map(a => a.examId))).map(examId => {
                      const exam = exams.find(e => e.id === examId);
                      return (
                        <option key={examId} value={examId}>
                          {exam?.title || 'Đề thi không xác định'}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                {selectedExamForResults && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Chọn lớp:</label>
                    <select 
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white w-full sm:w-48"
                      value={selectedClassForResults}
                      onChange={(e) => setSelectedClassForResults(e.target.value)}
                    >
                      <option value="">-- Chọn lớp --</option>
                      {assignments
                        .filter(a => a.examId === selectedExamForResults)
                        .map(a => {
                          const cls = classes.find(c => c.id === a.classId);
                          return (
                            <option key={a.classId} value={a.classId}>
                              {cls?.name || 'Lớp không xác định'} ({a.mode === 'EXAM' ? 'Thi' : 'Ôn luyện'})
                            </option>
                          );
                        })}
                    </select>
                  </div>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {(!selectedExamForResults || !selectedClassForResults) ? (
                <div className="p-12 text-center text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p>Vui lòng chọn bài tập và lớp học để xem bảng điểm.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                      <th className="p-4 font-bold w-16 text-center">STT</th>
                      <th className="p-4 font-bold">Số báo danh</th>
                      <th className="p-4 font-bold">Họ và tên</th>
                      <th className="p-4 font-bold text-center">Điểm số</th>
                      <th className="p-4 font-bold text-center">Xếp hạng</th>
                      <th className="p-4 font-bold text-center">Thời gian nộp</th>
                      <th className="p-4 font-bold text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      // Find the specific assignment for this exam and class
                      const assignment = assignments.find(a => a.examId === selectedExamForResults && a.classId === selectedClassForResults);
                      
                      if (!assignment) {
                        return (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-gray-500">
                              Không tìm thấy bài tập cho lớp này.
                            </td>
                          </tr>
                        );
                      }

                      // Get attempts for this assignment
                      const assignmentAttempts = attempts.filter(a => a.assignmentId === assignment.id);
                      
                      // Group by student and get their highest score for this assignment
                      const studentBestAttempts = new Map<string, Attempt>();
                      assignmentAttempts.forEach(attempt => {
                        const existing = studentBestAttempts.get(attempt.studentId);
                        if (!existing || attempt.score > existing.score) {
                          studentBestAttempts.set(attempt.studentId, attempt);
                        }
                      });

                      // Convert to array and sort by score descending
                      const sortedAttempts = Array.from(studentBestAttempts.values()).sort((a, b) => b.score - a.score);

                      if (sortedAttempts.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-gray-500">
                              Chưa có học sinh nào nộp bài tập này.
                            </td>
                          </tr>
                        );
                      }

                      // Calculate ranks with ties
                      let currentRank = 1;
                      let previousScore = -1;
                      const rankedAttempts = sortedAttempts.map((attempt, index) => {
                        if (attempt.score !== previousScore) {
                          currentRank = index + 1;
                        }
                        previousScore = attempt.score;
                        return { ...attempt, rank: currentRank };
                      });

                      return rankedAttempts.map((attempt, index) => {
                        const student = students.find(s => s.id === attempt.studentId);
                        const isTop3 = attempt.rank <= 3;
                        
                        return (
                          <tr key={attempt.id} className={`hover:bg-gray-50/50 transition-colors ${attempt.rank === 1 ? 'bg-yellow-50/30' : ''}`}>
                            <td className="p-4 text-center font-medium text-gray-500">
                              {index + 1}
                            </td>
                            <td className="p-4 font-mono font-medium text-gray-600">{student?.sbd || 'N/A'}</td>
                            <td className="p-4 font-bold text-gray-800">{student?.fullName || 'Học sinh không xác định'}</td>
                            <td className="p-4 text-center">
                              <span className={`font-bold text-lg ${attempt.score >= 8 ? 'text-green-600' : attempt.score >= 5 ? 'text-blue-600' : 'text-red-600'}`}>
                                {attempt.score.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                                attempt.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                attempt.rank === 2 ? 'bg-gray-200 text-gray-700' :
                                attempt.rank === 3 ? 'bg-orange-100 text-orange-700' :
                                'text-gray-500'
                              }`}>
                                {attempt.rank}
                              </span>
                            </td>
                            <td className="p-4 text-center text-sm text-gray-500">
                              {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('vi-VN') : 'Không xác định'}
                            </td>
                            <td className="p-4 text-center">
                              <button 
                                onClick={() => handleDeleteAttempt(attempt.id, student?.fullName || 'Học sinh')}
                                className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors inline-flex"
                                title="Xóa bài làm"
                              >
                                <Trash2 className="w-5 h-5" />
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

      {/* Add Class Modal */}
      {isAddClassModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">Thêm Lớp học mới</h2>
              <button 
                onClick={() => setIsAddClassModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddClassSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tên lớp</label>
                <input 
                  type="text" 
                  required
                  placeholder="VD: Lớp 12A1"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddClassModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                >
                  Thêm lớp học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Student Modal - Removed */}

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">Giao bài mới</h2>
              <button 
                onClick={() => setIsAssignModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAssignSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Chọn đề thi</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  required
                >
                  <option value="">-- Chọn đề thi --</option>
                  {exams.map(exam => (
                    <option key={exam.id} value={exam.id}>{exam.title}</option>
                  ))}
                </select>
                {exams.length === 0 && (
                  <p className="text-sm text-red-500 mt-1">Bạn chưa tạo đề thi nào. Hãy tạo đề trước.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Giao cho lớp</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  required
                >
                  {classes.length === 0 && <option value="">-- Chưa có lớp --</option>}
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {classes.length === 0 && (
                  <p className="text-sm text-red-500 mt-1">Bạn cần tạo lớp học trước khi giao bài.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Chế độ làm bài</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('EXAM')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                      selectedMode === 'EXAM' 
                        ? 'border-red-500 bg-red-50 text-red-700' 
                        : 'border-gray-200 text-gray-500 hover:border-red-200 hover:bg-red-50/50'
                    }`}
                  >
                    <CheckCircle2 className={`w-6 h-6 ${selectedMode === 'EXAM' ? 'text-red-500' : ''}`} />
                    <span className="font-bold text-sm">Thi Online</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('PRACTICE')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                      selectedMode === 'PRACTICE' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 text-gray-500 hover:border-blue-200 hover:bg-blue-50/50'
                    }`}
                  >
                    <BrainCircuit className={`w-6 h-6 ${selectedMode === 'PRACTICE' ? 'text-blue-500' : ''}`} />
                    <span className="font-bold text-sm">Ôn luyện</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Thời gian làm bài</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Bắt đầu</label>
                    <input 
                      type="datetime-local" 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Kết thúc</label>
                    <input 
                      type="datetime-local" 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={exams.length === 0}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Giao bài ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Thông báo</h3>
            <p className="text-gray-600 mb-6">{alertDialog.message}</p>
            <button 
              onClick={() => setAlertDialog({ ...alertDialog, isOpen: false })}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Xác nhận xóa</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
