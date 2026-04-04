import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, MessageSquare, Lightbulb, Eye, Edit3, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { store } from '@/lib/store';
import { Exam } from '@/types';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useAuth } from '@/lib/AuthContext';

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

export default function ExamEditor() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  // State for answers and explanations
  const [part1Data, setPart1Data] = useState<Record<number, { answer?: string, explanation?: string, hint?: string }>>({});
  const [part2Data, setPart2Data] = useState<Record<number, { answers: Record<string, boolean>, explanation?: string, hint?: string }>>({});
  const [part3Data, setPart3Data] = useState<Record<number, { answer?: string, explanation?: string, hint?: string }>>({});

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Vui lòng nhập tên đề thi!');
      return;
    }

    if (!userProfile?.uid) {
      alert('Vui lòng đăng nhập lại!');
      return;
    }

    const newExam: Exam = {
      id: Date.now().toString(),
      title: title.trim(),
      teacherId: userProfile.uid,
      part1: part1Data,
      part2: part2Data,
      part3: part3Data,
      createdAt: Date.now()
    };

    await store.saveExam(newExam);
    alert('Đã lưu đề thi thành công!\n\nLƯU Ý: Đề thi mới chỉ được lưu vào kho. Bạn cần quay lại màn hình Quản lý và bấm "Giao bài" để học sinh có thể thấy và làm bài.');
    navigate('/teacher');
  };

  const toggleExplanation = (id: string) => {
    setExpandedExplanation(prev => prev === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => navigate('/teacher')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-gray-900 mb-2">Nhập Đáp Án & Lời Giải</h1>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên đề thi (VD: Khảo sát chất lượng Lớp 12 - Đề 01)"
                className="w-full md:w-2/3 border border-gray-300 rounded-md px-3 py-2 font-medium focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
          </div>
          <button 
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all shrink-0"
          >
            <Save className="w-5 h-5" />
            Lưu Đề Thi
          </button>
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
                    <div key={qNum} className="border border-gray-200 p-4 rounded-xl hover:border-blue-300 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="font-black text-lg w-12 shrink-0 text-gray-700 whitespace-nowrap">Câu {qNum}</span>
                          <div className="flex gap-2">
                            {['A', 'B', 'C', 'D'].map(opt => (
                              <button
                                key={opt}
                                onClick={() => setPart1Data(prev => ({ ...prev, [qNum]: { ...prev[qNum], answer: opt } }))}
                                className={cn(
                                  "w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold transition-all",
                                  part1Data[qNum]?.answer === opt 
                                    ? "bg-green-500 border-green-500 text-white" 
                                    : "border-gray-300 text-gray-600 hover:border-green-400 hover:bg-green-50"
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
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
                    
                    <div className="grid grid-cols-1 gap-4">
                      {['a', 'b', 'c', 'd'].map(sub => {
                        const subId = `${id}-${sub}`;
                        const hasExplanation = !!part2Data[qNum]?.explanations?.[sub]?.explanation;
                        
                        return (
                          <div key={sub} className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <span className="font-bold text-gray-700">Ý {sub})</span>
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
