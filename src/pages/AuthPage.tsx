import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { LogIn, UserPlus, GraduationCap, BookOpen, AlertCircle, Mail, Lock, User as UserIcon, Hash, School, Sparkles, BrainCircuit, Laptop } from 'lucide-react';
import { store } from '@/lib/store';
import { Class, User, Student } from '@/types';
import { useAuth } from '@/lib/AuthContext';

export default function AuthPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [sbd, setSbd] = useState('');
  const [classId, setClassId] = useState('');
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sbdErrorModal, setSbdErrorModal] = useState(false);

  useEffect(() => {
    // Redirect if already logged in
    if (userProfile) {
      if (userProfile.role === 'TEACHER') {
        navigate('/teacher');
      } else {
        navigate('/student');
      }
    }
  }, [userProfile, navigate]);

  useEffect(() => {
    if (!isLogin && role === 'STUDENT') {
      const loadData = async () => {
        const [loadedClasses, loadedTeachers] = await Promise.all([
          store.getClasses(), // Get all classes
          store.getTeachers() // Get all teachers
        ]);
        setClasses(loadedClasses);
        setTeachers(loadedTeachers);
        if (loadedClasses.length > 0) {
          setClassId(loadedClasses[0].id);
        }
      };
      loadData();
    }
  }, [isLogin, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        // Navigation is handled by the useEffect above when userProfile updates
      } else {
        if (role === 'STUDENT') {
          if (!/^\d{6}$/.test(sbd)) {
            throw new Error('Số báo danh phải bao gồm đúng 6 chữ số.');
          }
          if (!classId) {
            throw new Error('Vui lòng chọn lớp học.');
          }
          // Check if SBD already exists
          const students = await store.getStudents();
          if (students.some(s => s.sbd === sbd)) {
            setSbdErrorModal(true);
            setLoading(false);
            return;
          }
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const newUser: User = {
          uid,
          email,
          role,
          fullName,
          createdAt: Date.now()
        };

        await setDoc(doc(db, 'users', uid), newUser);

        if (role === 'STUDENT') {
          const selectedClassObj = classes.find(c => c.id === classId);
          
          const newStudent: Student = {
            id: uid,
            sbd,
            fullName,
            classId,
            teacherId: selectedClassObj?.teacherId || '',
            createdAt: Date.now()
          };
          await setDoc(doc(db, 'students', uid), newStudent);
        }
      }
    } catch (err: any) {
      console.error(err);
      let errorMessage = 'Có lỗi xảy ra. Vui lòng thử lại.';
      
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc sử dụng email khác.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Email không hợp lệ.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Mật khẩu quá yếu (cần ít nhất 6 ký tự).';
            break;
          case 'auth/user-not-found':
            errorMessage = 'Không tìm thấy tài khoản với email này.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Mật khẩu không đúng.';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Thông tin đăng nhập không chính xác.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra lại kết nối internet hoặc cấu hình Firebase (Authorized domains).';
            break;
          default:
            errorMessage = err.message || errorMessage;
        }
      } else {
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div translate="no" className="notranslate min-h-screen bg-gray-50 flex font-sans relative overflow-hidden">
      {/* Left Panel - Branding & Illustration (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        {/* Background Image with Elegant Dark Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80")' }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/95 via-teal-900/90 to-emerald-950/95 z-0 mix-blend-multiply"></div>
        
        {/* Decorative floating elements */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-[80px] z-0 animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-teal-400/20 rounded-full blur-[80px] z-0 animate-pulse delay-1000"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-lg">
              <BrainCircuit className="w-7 h-7 text-emerald-300" />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">SmartEdu AI</h2>
          </div>
          
          <h1 className="text-5xl xl:text-6xl font-extrabold text-white leading-tight mb-6 tracking-tight">
            PHIẾU TRẮC NGHIỆM <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-200">
              THÔNG MINH
            </span>
          </h1>
          <p className="text-emerald-50/80 text-lg xl:text-xl max-w-lg leading-relaxed font-medium">
            Ứng dụng trí tuệ nhân tạo để cá nhân hóa lộ trình học tập, tự động hóa quy trình kiểm tra và đánh giá năng lực học sinh toàn diện.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-6 mt-16 max-w-xl">
          <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex items-start gap-4 hover:bg-white/15 transition-all duration-300 group">
            <div className="bg-emerald-500/20 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Sparkles className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1 text-lg">AI Hỗ trợ</h3>
              <p className="text-emerald-100/70 text-sm leading-relaxed">Tự động tạo đề, chấm điểm và phân tích năng lực chi tiết.</p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex items-start gap-4 hover:bg-white/15 transition-all duration-300 group">
            <div className="bg-teal-500/20 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Laptop className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1 text-lg">Đa nền tảng</h3>
              <p className="text-emerald-100/70 text-sm leading-relaxed">Ôn luyện và làm bài thi trực tuyến mọi lúc, mọi nơi.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 relative bg-gray-50/50">
        {/* Mobile background elements */}
        <div className="lg:hidden absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="lg:hidden absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-teal-400/10 rounded-full blur-3xl"></div>
        
        <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] w-full max-w-[440px] border border-gray-100 relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 transform rotate-3 transition-transform hover:rotate-0 duration-300">
              {role === 'TEACHER' ? <BookOpen className="w-8 h-8" /> : <GraduationCap className="w-8 h-8" />}
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
              {isLogin ? 'ÔN LUYỆN HIỆU QUẢ' : 'Tạo tài khoản'}
            </h2>
            <p className="text-gray-500 font-medium">
              {isLogin ? 'Đăng nhập để tiếp tục học tập' : 'Bắt đầu hành trình tri thức mới'}
            </p>
          </div>

          <div className="flex p-1 mb-8 bg-gray-100/80 rounded-xl">
            <button
              type="button"
              onClick={() => setRole('STUDENT')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${role === 'STUDENT' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <GraduationCap className="w-4 h-4" /> Học sinh
            </button>
            <button
              type="button"
              onClick={() => setRole('TEACHER')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${role === 'TEACHER' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BookOpen className="w-4 h-4" /> Giáo viên
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Họ và tên</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-3 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400 text-gray-900 font-medium"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="email@truonghoc.edu.vn"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-3 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400 text-gray-900 font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Mật khẩu</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-3 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400 text-gray-900 font-medium tracking-widest"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {!isLogin && role === 'STUDENT' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Số báo danh</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Hash className="h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="123456"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-3 font-mono text-center tracking-widest focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400 placeholder:tracking-normal text-gray-900 font-bold"
                      value={sbd}
                      onChange={(e) => setSbd(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Lớp học</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <School className="h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <select
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-3 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all appearance-none text-gray-900 font-medium"
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                    >
                      {classes.map(c => {
                        const teacher = teachers.find(t => t.uid === c.teacherId);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} {teacher ? `- GV: ${teacher.fullName}` : ''}
                          </option>
                        );
                      })}
                      {classes.length === 0 && <option value="">Không có lớp</option>}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 mt-2 bg-red-50 p-3 rounded-xl border border-red-100">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-[0_8px_20px_-6px_rgba(5,150,105,0.4)] disabled:opacity-70 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                isLogin ? <><LogIn className="w-5 h-5" /> ĐĂNG NHẬP</> : <><UserPlus className="w-5 h-5" /> ĐĂNG KÝ TÀI KHOẢN</>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm mb-3 font-medium">
              {isLogin ? 'Chưa có tài khoản tham gia?' : 'Đã có tài khoản trên hệ thống?'}
            </p>
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-bold transition-all hover:bg-emerald-50 px-4 py-2 rounded-lg"
            >
              {isLogin ? 'Tạo tài khoản mới ngay' : 'Quay lại Đăng nhập'}
            </button>
          </div>
        </div>
      </div>

      {/* SBD Error Modal */}
      {sbdErrorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Trùng Số Báo Danh</h3>
              <p className="text-gray-600 mb-6">
                Số báo danh <strong className="text-red-600">{sbd}</strong> đã được sử dụng bởi một học sinh khác. Vui lòng chọn một số báo danh khác để đăng ký!
              </p>
              <button
                onClick={() => setSbdErrorModal(false)}
                className="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
              >
                Đã hiểu và chọn số khác
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
