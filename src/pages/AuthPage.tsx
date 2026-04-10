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

  // Student accounts are provisioned by teachers -> disable self-registration for STUDENT
  useEffect(() => {
    if (role === 'STUDENT' && !isLogin) {
      setIsLogin(true);
      setError('Tài khoản học sinh do giáo viên cấp. Vui lòng đăng nhập bằng tài khoản đã được cung cấp.');
    }
  }, [role, isLogin]);

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
          throw new Error('Đăng ký tài khoản học sinh đã bị khóa. Vui lòng liên hệ giáo viên để nhận tài khoản.');
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
    <div translate="no" className="notranslate min-h-screen bg-slate-950 flex font-sans relative overflow-hidden text-slate-100 selection:bg-emerald-500/30">
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-screen"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/80"></div>
      
      {/* Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-teal-400/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      <div className="absolute top-[40%] left-[60%] w-64 h-64 bg-emerald-300/10 rounded-full blur-[80px] animate-pulse delay-500"></div>

      {/* Left Panel - Branding & Illustration (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden z-10">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-14 h-14 bg-emerald-500/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <BrainCircuit className="w-7 h-7 text-emerald-300" />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">SmartEdu AI</h2>
          </div>
          
          <h1 className="text-5xl xl:text-6xl font-extrabold text-white leading-tight mb-6 tracking-tight drop-shadow-lg">
            PHIẾU TRẮC NGHIỆM <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 drop-shadow-sm">
              THÔNG MINH
            </span>
          </h1>
          <p className="text-emerald-100/80 text-lg xl:text-xl max-w-lg leading-relaxed font-medium">
            Ứng dụng trí tuệ nhân tạo để cá nhân hóa lộ trình học tập, tự động hóa quy trình kiểm tra và đánh giá năng lực học sinh toàn diện.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-6 mt-16 max-w-xl">
          <div className="glass-card p-5 flex items-start gap-4 hover:bg-slate-800/90 transition-all duration-300 group">
            <div className="bg-emerald-500/20 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Sparkles className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1 text-lg">AI Hỗ trợ</h3>
              <p className="text-emerald-100/70 text-sm leading-relaxed">Tự động tạo đề, chấm điểm và phân tích năng lực chi tiết.</p>
            </div>
          </div>
          <div className="glass-card p-5 flex items-start gap-4 hover:bg-slate-800/90 transition-all duration-300 group">
            <div className="bg-teal-500/20 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(45,212,191,0.2)]">
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 relative z-10 safe-pt safe-pb">
        <div className="glass-panel p-8 sm:p-10 rounded-[2rem] w-full max-w-[440px] relative overflow-hidden">
          {/* Form inner glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-emerald-500/10 blur-3xl pointer-events-none"></div>

          <div className="text-center mb-8 relative z-10">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-300 rounded-2xl flex items-center justify-center mx-auto mb-5 transform rotate-3 transition-transform hover:rotate-0 duration-300 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              {role === 'TEACHER' ? <BookOpen className="w-8 h-8" /> : <GraduationCap className="w-8 h-8" />}
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              {isLogin ? 'ÔN LUYỆN HIỆU QUẢ' : 'TẠO TÀI KHOẢN'}
            </h2>
            <p className="text-emerald-200/60 font-medium">
              {isLogin ? 'Đăng nhập để tiếp tục học tập' : 'Bắt đầu hành trình tri thức mới'}
            </p>
          </div>

          <div className="flex p-1 mb-8 bg-slate-800/50 rounded-xl border border-slate-700/50 relative z-10">
            <button
              type="button"
              onClick={() => setRole('STUDENT')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${role === 'STUDENT' ? 'bg-emerald-500/20 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)] border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <GraduationCap className="w-4 h-4" /> Học sinh
            </button>
            <button
              type="button"
              onClick={() => setRole('TEACHER')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${role === 'TEACHER' ? 'bg-emerald-500/20 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)] border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <BookOpen className="w-4 h-4" /> Giáo viên
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {!isLogin && (
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1.5">Họ và tên</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-3 focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-500 text-white font-medium"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="email@truonghoc.edu.vn"
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-3 focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-500 text-white font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">Mật khẩu</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-3 focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-500 text-white font-medium tracking-widest"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {!isLogin && role === 'STUDENT' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">Số báo danh</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Hash className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="123456"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-9 pr-3 py-3 font-mono text-center tracking-widest focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-500 placeholder:tracking-normal text-white font-bold"
                      value={sbd}
                      onChange={(e) => setSbd(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">Lớp học</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <School className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    </div>
                    <select
                      required
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-9 pr-3 py-3 focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all appearance-none text-white font-medium [&>option]:bg-slate-800"
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
              <div className="flex items-start gap-2 text-sm text-red-400 mt-2 bg-red-950/50 p-3 rounded-xl border border-red-900/50">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] disabled:opacity-70 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                isLogin ? <><LogIn className="w-5 h-5" /> ĐĂNG NHẬP</> : <><UserPlus className="w-5 h-5" /> ĐĂNG KÝ TÀI KHOẢN</>
              )}
            </button>
          </form>

          <div className="mt-8 text-center relative z-10">
            <p className="text-slate-400 text-sm mb-3 font-medium">
              {isLogin ? 'Chưa có tài khoản tham gia?' : 'Đã có tài khoản trên hệ thống?'}
            </p>
            {role === 'TEACHER' ? (
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="text-sm text-emerald-400 hover:text-emerald-300 font-bold transition-all hover:bg-emerald-500/10 px-4 py-2 rounded-lg"
              >
                {isLogin ? 'Tạo tài khoản mới ngay' : 'Quay lại Đăng nhập'}
              </button>
            ) : (
              <div className="text-xs text-slate-400">
                Tài khoản học sinh do giáo viên cấp. Vui lòng đăng nhập.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SBD Error Modal */}
      {sbdErrorModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Trùng Số Báo Danh</h3>
              <p className="text-slate-400 mb-6">
                Số báo danh <strong className="text-red-400">{sbd}</strong> đã được sử dụng bởi một học sinh khác. Vui lòng chọn một số báo danh khác để đăng ký!
              </p>
              <button
                onClick={() => setSbdErrorModal(false)}
                className="w-full py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-400 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
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
