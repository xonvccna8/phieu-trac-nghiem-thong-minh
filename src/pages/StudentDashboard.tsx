import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, BookOpen, TrendingUp, Target, Award, Sparkles, LogIn, CheckCircle2, Eye, Clock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { store } from '@/lib/store';
import { Assignment, Attempt, Exam, Student, Class } from '@/types';

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
      unsubClasses();
      unsubExams();
      unsubAssignments();
      unsubAttempts();
    };
  }, [loggedInStudent]);

  useEffect(() => {
    if (loggedInStudent) {
      setAssignments(allAssignments); // allAssignments is already filtered by classId
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
    return <div className="min-h-screen flex items-center justify-center">Đang tải dữ liệu học sinh...</div>;
  }

  if (!loggedInStudent || !userProfile) {
    return <div className="p-8 text-center">Không tìm thấy thông tin học sinh. Vui lòng đăng nhập lại.</div>;
  }

  // Calculate recent score
  const recentAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const recentScore = recentAttempt?.score || 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & AI Insight */}
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Chào em, {loggedInStudent.fullName}! 👋</h1>
              <p className="text-blue-100 mt-1">Lớp: {studentClass || 'Không xác định'} | SBD: {loggedInStudent.sbd}</p>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm text-center flex-1 md:flex-none">
                <div className="text-sm text-blue-100 font-medium">Điểm gần nhất</div>
                <div className="text-3xl font-black">{recentScore.toFixed(2)}</div>
              </div>
              <button 
                onClick={handleLogout}
                className="text-sm text-blue-100 hover:text-white underline shrink-0"
              >
                Đăng xuất
              </button>
            </div>
          </div>
          
          <div className="p-6 bg-gradient-to-b from-blue-50/50 to-white">
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg mb-2 flex items-center gap-2">
                  Nhận xét từ Thầy (AI hỗ trợ)
                </h3>
                {attempts.length > 0 ? (
                  <>
                    <p className="text-gray-700 leading-relaxed mb-3">
                      Dựa trên bài làm gần nhất, em đạt {recentScore.toFixed(2)} điểm. Hãy xem lại các câu sai để rút kinh nghiệm nhé.
                    </p>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-blue-800 font-medium italic">
                      "Thầy tin em làm được! Hãy tiếp tục cố gắng ở các bài tập tiếp theo."
                    </div>
                  </>
                ) : (
                  <p className="text-gray-700 leading-relaxed">
                    Em chưa làm bài nào. Hãy bắt đầu làm các bài tập được giao bên dưới nhé!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content - Assignments */}
          <div className="md:col-span-2 space-y-8">
            {/* Pending Assignments */}
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Target className="w-6 h-6 text-red-500" />
                Nhiệm vụ cần hoàn thành
              </h2>
              
              <div className="space-y-4">
                {assignments.filter(a => !attempts.some(att => att.assignmentId === a.id)).length === 0 ? (
                  <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500">
                    Hiện tại em chưa có bài tập nào cần làm.
                  </div>
                ) : (
                  assignments.filter(a => !attempts.some(att => att.assignmentId === a.id)).map(assignment => {
                    const exam = exams.find(e => e.id === assignment.examId);
                    
                    return (
                      <div key={assignment.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 transition-all flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                              assignment.mode === 'EXAM' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {assignment.mode === 'EXAM' ? 'THI ONLINE' : 'ÔN LUYỆN'}
                            </span>
                            <span className="text-sm text-gray-500 font-medium flex items-center gap-1"><Clock className="w-4 h-4" /> {assignment.startDate ? `Từ: ${assignment.startDate.replace('T', ' ')} - ` : ''}Hạn: {assignment.dueDate.replace('T', ' ')}</span>
                          </div>
                          <h3 className="font-bold text-lg text-gray-800">{exam?.title || 'Đề thi'}</h3>
                        </div>
                        
                        <button 
                          onClick={() => handleStartAssignment(assignment)}
                          className={`shrink-0 px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all w-full sm:w-auto ${
                            assignment.mode === 'EXAM' 
                              ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200' 
                              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                          }`}
                        >
                          {assignment.mode === 'EXAM' ? <PlayCircle className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                          {assignment.mode === 'EXAM' ? 'Bắt đầu thi' : 'Vào ôn luyện'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Completed Assignments */}
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-500" />
                Kết quả bài làm
              </h2>
              
              <div className="space-y-4">
                {assignments.filter(a => attempts.some(att => att.assignmentId === a.id)).length === 0 ? (
                  <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500">
                    Em chưa hoàn thành bài tập nào.
                  </div>
                ) : (
                  assignments.filter(a => attempts.some(att => att.assignmentId === a.id)).map(assignment => {
                    const exam = exams.find(e => e.id === assignment.examId);
                    
                    // Lấy điểm cao nhất của học sinh cho bài tập này
                    const studentAttempts = attempts.filter(att => att.assignmentId === assignment.id);
                    const bestAttempt = studentAttempts.reduce((best, current) => (current?.score || 0) > (best?.score || 0) ? current : best, studentAttempts[0]);
                    
                    // Tính xếp hạng
                    const allAttemptsForAssignment = allAttempts.filter(att => att.assignmentId === assignment.id);
                    const studentBestAttempts = new Map<string, Attempt>();
                    allAttemptsForAssignment.forEach(attempt => {
                      const existing = studentBestAttempts.get(attempt.studentId);
                      if (!existing || (attempt.score || 0) > (existing.score || 0)) {
                        studentBestAttempts.set(attempt.studentId, attempt);
                      }
                    });
                    const sortedScores = Array.from(studentBestAttempts.values()).map(a => a.score || 0).sort((a, b) => b - a);
                    const rank = sortedScores.indexOf(bestAttempt?.score || 0) + 1;
                    const totalStudents = sortedScores.length;

                    return (
                      <div key={assignment.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center opacity-80 hover:opacity-100 transition-opacity">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                              assignment.mode === 'EXAM' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {assignment.mode === 'EXAM' ? 'THI ONLINE' : 'ÔN LUYỆN'}
                            </span>
                            <span className="text-sm text-green-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Đã hoàn thành
                            </span>
                          </div>
                          <h3 className="font-bold text-lg text-gray-800">{exam?.title || 'Đề thi'}</h3>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                          <div className="flex items-center justify-center gap-6 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 w-full sm:w-auto">
                            <div className="text-center">
                              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Điểm số</div>
                              <div className={`font-black text-xl ${(bestAttempt?.score || 0) >= 8 ? 'text-green-600' : (bestAttempt?.score || 0) >= 5 ? 'text-blue-600' : 'text-red-600'}`}>
                                {(bestAttempt?.score || 0).toFixed(2)}
                              </div>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Xếp hạng</div>
                              <div className="font-black text-xl text-orange-600">
                                {rank}<span className="text-sm text-gray-400 font-medium">/{totalStudents}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                            <button 
                              onClick={() => navigate(`/exam/${assignment.id}?mode=REVIEW`)}
                              className="shrink-0 px-4 py-2 sm:px-3 sm:py-1.5 sm:text-sm rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                            >
                              <Eye className="w-4 h-4" />
                              Xem chi tiết
                            </button>
                            {(assignment.mode === 'PRACTICE' || (assignment.mode === 'EXAM' && studentAttempts.length < (assignment.maxAttempts || 1))) && (
                              <button 
                                onClick={() => handleStartAssignment(assignment)}
                                className="shrink-0 px-4 py-2 sm:px-3 sm:py-1.5 sm:text-sm rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200"
                              >
                                <PlayCircle className="w-4 h-4" />
                                Làm lại {assignment.mode === 'EXAM' ? `(còn ${((assignment.maxAttempts || 1) - studentAttempts.length)} lần)` : ''}
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

          {/* Sidebar - Stats */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Phân tích năng lực
              </h3>
              
              <div className="space-y-4">
                <div className="text-sm text-gray-500 text-center py-4">
                  Làm thêm bài tập để AI có thể phân tích điểm mạnh và điểm yếu của em.
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
              <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                <Award className="w-5 h-5" />
                Tiến độ
              </h3>
              <p className="text-sm text-indigo-800 mb-4">Em đã hoàn thành {attempts.length} bài tập.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
