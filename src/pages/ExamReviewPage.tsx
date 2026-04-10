import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle2, Eye, FileCheck2, FileWarning, Save, Sparkles, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { store } from '@/lib/store';
import { RichTextDisplay } from '@/components/RichTextDisplay';
import { RichTextEditor } from '@/components/RichTextEditor';
import { clearImportReviewDraft, loadImportReviewDraft } from '@/lib/importReviewDraft';
import { solveQuestionWithAI } from '@/lib/aiSolveApi';
import { cn } from '@/lib/utils';
import type { Exam, ExamImportWarning, ExamTemplateType, Part1QuestionData, Part2QuestionData, Part3QuestionData } from '@/types';
import type { SolvePart1Result, SolvePart2Result, SolvePart3Result } from '../../server/aiSolvePrompts';

function sortNumericEntries<T>(record: Record<number, T>) {
  return Object.entries(record)
    .map(([key, value]) => [Number(key), value] as const)
    .sort((a, b) => a[0] - b[0]);
}

function MetadataField({
  label,
  value,
  onChange,
  readOnly = false,
  textarea = false,
}: {
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700">{label}</label>
      {textarea ? (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 read-only:bg-slate-50"
        />
      ) : (
        <input
          value={String(value ?? '')}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 read-only:bg-slate-50"
        />
      )}
    </div>
  );
}

function RichContentField({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700">{label}</label>
      {readOnly ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 min-h-20">
          <RichTextDisplay html={value || '<p class="text-slate-400">Chưa có nội dung</p>'} />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200">
          <RichTextEditor
            value={value}
            onChange={(nextValue) => onChange?.(nextValue)}
            placeholder={placeholder}
            className={className || 'h-28 mb-12'}
          />
        </div>
      )}
    </div>
  );
}

export default function ExamReviewPage() {
  const navigate = useNavigate();
  const { id: examId } = useParams<{ id: string }>();
  const { userProfile } = useAuth();
  const isViewMode = Boolean(examId);

  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [templateType, setTemplateType] = useState<ExamTemplateType>('ONLINE_EXAM');
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [totalScore, setTotalScore] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [part1Data, setPart1Data] = useState<Record<number, Part1QuestionData>>({});
  const [part2Data, setPart2Data] = useState<Record<number, Part2QuestionData>>({});
  const [part3Data, setPart3Data] = useState<Record<number, Part3QuestionData>>({});
  const [warnings, setWarnings] = useState<ExamImportWarning[]>([]);
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [showWarnings, setShowWarnings] = useState(false);
  const [solvingQuestionKey, setSolvingQuestionKey] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isViewMode && examId) {
        const exam = await store.getExamById(examId);
        if (!isMounted) return;

        if (!exam) {
          alert('Không tìm thấy đề thi để xem.');
          navigate('/teacher');
          return;
        }

        setTitle(exam.title || '');
        setSubject(exam.subject || '');
        setGrade(exam.grade || '');
        setDescription(exam.description || '');
        setInstructions(exam.instructions || '');
        setTemplateType(exam.templateType || 'ONLINE_EXAM');
        setDurationMinutes(exam.onlineSettings?.durationMinutes || 50);
        setTotalScore(exam.onlineSettings?.totalScore || 10);
        setMaxAttempts(exam.onlineSettings?.maxAttempts || 1);
        setPart1Data(exam.part1 || {});
        setPart2Data(exam.part2 || {});
        setPart3Data(exam.part3 || {});
        setWarnings(exam.importSource?.warnings || []);
        setSourceFileName(exam.importSource?.fileName || '');
        setSourceLabel(exam.importSource?.type === 'WORD' ? 'Đề đã nhập từ Word' : 'Đề tạo thủ công');
        setIsLoading(false);
        return;
      }

      const draft = loadImportReviewDraft();
      if (!isMounted) return;

      if (!draft) {
        alert('Không còn dữ liệu đề vừa chuẩn hóa. Hãy tải file Word lại.');
        navigate('/teacher/exam/new?source=word');
        return;
      }

      setTitle(draft.title);
      setSubject(draft.subject);
      setGrade(draft.grade);
      setDescription(draft.description);
      setInstructions(draft.instructions);
      setTemplateType(draft.templateType);
      setDurationMinutes(draft.durationMinutes);
      setTotalScore(draft.totalScore);
      setMaxAttempts(draft.maxAttempts);
      setPart1Data(draft.part1);
      setPart2Data(draft.part2);
      setPart3Data(draft.part3);
      setWarnings(draft.warnings);
      setSourceFileName(draft.fileName);
      setSourceLabel(draft.sourceLabel);
      setIsLoading(false);
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [examId, isViewMode, navigate]);

  const warningSummary = useMemo(() => ({
    errors: warnings.filter((item) => item.level === 'error').length,
    warnings: warnings.filter((item) => item.level === 'warning').length,
    info: warnings.filter((item) => item.level === 'info').length,
  }), [warnings]);

  const updatePart1 = (qNum: number, updater: (current: Part1QuestionData) => Part1QuestionData) => {
    setPart1Data((prev) => ({
      ...prev,
      [qNum]: updater(prev[qNum] || {}),
    }));
  };

  const updatePart2 = (qNum: number, updater: (current: Part2QuestionData) => Part2QuestionData) => {
    setPart2Data((prev) => ({
      ...prev,
      [qNum]: updater(prev[qNum] || { answers: {} }),
    }));
  };

  const updatePart3 = (qNum: number, updater: (current: Part3QuestionData) => Part3QuestionData) => {
    setPart3Data((prev) => ({
      ...prev,
      [qNum]: updater(prev[qNum] || {}),
    }));
  };

  const handleCreateExam = async () => {
    if (isViewMode) {
      navigate(`/teacher/exam/edit/${examId}`);
      return;
    }

    if (!userProfile?.uid) {
      alert('Vui lòng đăng nhập lại.');
      return;
    }

    if (!title.trim()) {
      alert('Vui lòng nhập tên đề thi trước khi tạo.');
      return;
    }

    const exam: Exam = {
      id: Date.now().toString(),
      teacherId: userProfile.uid,
      title: title.trim(),
      templateType,
      status: 'DRAFT',
      subject: subject.trim(),
      grade: grade.trim(),
      description,
      instructions,
      onlineSettings: {
        durationMinutes,
        totalScore,
        maxAttempts,
        allowMultipleAttempts: maxAttempts > 1,
        showScoreImmediately: true,
        showAnswersAfterSubmit: false,
        requirePassword: false,
        password: '',
        autoSubmitWhenTimeUp: true,
        allowReviewAfterSubmit: true,
      },
      importSource: {
        type: 'WORD',
        fileName: sourceFileName,
        importedAt: Date.now(),
        warnings,
      },
      part1: part1Data,
      part2: part2Data,
      part3: part3Data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await store.saveExam(exam);
    clearImportReviewDraft();
    alert('Đã tạo đề thi từ bản chuẩn hóa. Bạn có thể tiếp tục xem, sửa hoặc giao bài ở trang giáo viên.');
    navigate('/teacher');
  };

  const solvePart1Question = async (qNum: number, question: Part1QuestionData) => {
    setSolvingQuestionKey(`P1-${qNum}`);
    try {
      const result = await solveQuestionWithAI({
        subject,
        grade,
        title,
        questionKind: 'PART1',
        questionNumber: qNum,
        questionHtml: question.question || '',
        choices: {
          A: question.choices?.A || '',
          B: question.choices?.B || '',
          C: question.choices?.C || '',
          D: question.choices?.D || '',
        },
        currentAnswer: question.answer || '',
        currentExplanation: question.explanation || '',
        currentHint: question.hint || '',
      }) as SolvePart1Result;

      updatePart1(qNum, (current) => ({
        ...current,
        answer: result.answer || current.answer || '',
        explanation: result.explanation || current.explanation || '',
        hint: result.hint || current.hint || '',
        similarExercise: result.similarExercise?.question
          ? {
              question: result.similarExercise.question,
              answer: result.similarExercise.answer,
            }
          : current.similarExercise,
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể dùng AI để giải câu này.');
    } finally {
      setSolvingQuestionKey(null);
    }
  };

  const solvePart2Question = async (qNum: number, question: Part2QuestionData) => {
    setSolvingQuestionKey(`P2-${qNum}`);
    try {
      const result = await solveQuestionWithAI({
        subject,
        grade,
        title,
        questionKind: 'PART2',
        questionNumber: qNum,
        questionHtml: question.question || '',
        statements: {
          a: question.statements?.a || '',
          b: question.statements?.b || '',
          c: question.statements?.c || '',
          d: question.statements?.d || '',
        },
        currentExplanation: question.explanation || '',
        currentHint: question.hint || '',
      }) as SolvePart2Result;

      updatePart2(qNum, (current) => ({
        ...current,
        answers: {
          ...current.answers,
          ...Object.fromEntries(
            Object.entries(result.answers || {}).filter(([, value]) => typeof value === 'boolean')
          ),
        },
        hint: result.hint || current.hint || '',
        explanations: {
          ...(current.explanations || {}),
          a: {
            ...(current.explanations?.a || {}),
            explanation: result.explanations?.a || current.explanations?.a?.explanation || '',
          },
          b: {
            ...(current.explanations?.b || {}),
            explanation: result.explanations?.b || current.explanations?.b?.explanation || '',
          },
          c: {
            ...(current.explanations?.c || {}),
            explanation: result.explanations?.c || current.explanations?.c?.explanation || '',
          },
          d: {
            ...(current.explanations?.d || {}),
            explanation: result.explanations?.d || current.explanations?.d?.explanation || '',
          },
        },
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể dùng AI để giải câu này.');
    } finally {
      setSolvingQuestionKey(null);
    }
  };

  const solvePart3Question = async (qNum: number, question: Part3QuestionData) => {
    setSolvingQuestionKey(`P3-${qNum}`);
    try {
      const result = await solveQuestionWithAI({
        subject,
        grade,
        title,
        questionKind: 'PART3',
        questionNumber: qNum,
        questionHtml: question.question || '',
        currentAnswer: question.answer || '',
        currentExplanation: question.explanation || '',
        currentHint: question.hint || '',
      }) as SolvePart3Result;

      updatePart3(qNum, (current) => ({
        ...current,
        answer: result.answer || current.answer || '',
        explanation: result.explanation || current.explanation || '',
        hint: result.hint || current.hint || '',
        similarExercise: result.similarExercise?.question
          ? {
              question: result.similarExercise.question,
              answer: result.similarExercise.answer,
            }
          : current.similarExercise,
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể dùng AI để giải câu này.');
    } finally {
      setSolvingQuestionKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Đang tải dữ liệu rà soát đề thi...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={() => navigate(isViewMode ? '/teacher' : '/teacher/exam/new?source=word')}
                className="mt-1 rounded-full p-2 hover:bg-slate-100"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  {isViewMode ? <Eye className="w-3.5 h-3.5" /> : <FileCheck2 className="w-3.5 h-3.5" />}
                  {isViewMode ? 'Xem đề thi' : 'Rà soát đề đã chuẩn hóa'}
                </div>
                <h1 className="mt-3 text-2xl md:text-3xl font-black text-slate-900">
                  {isViewMode ? title || 'Chi tiết đề thi' : 'Kiểm tra nội dung trước khi tạo đề'}
                </h1>
                <p className="mt-2 text-sm text-slate-500 max-w-3xl">
                  {isViewMode
                    ? 'Giáo viên có thể xem nhanh toàn bộ nội dung, đáp án và lời giải của đề thi đã lưu.'
                    : 'Đây là bản đề đã được hệ thống chuẩn hóa từ file Word. Bạn có thể kiểm tra, chỉnh sửa và xác nhận tạo đề ngay tại đây.'}
                </p>
                {(sourceFileName || sourceLabel) && (
                  <div className="mt-3 text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">Nguồn:</span> {sourceLabel || 'Đề nhập từ Word'}
                    {sourceFileName ? ` | ${sourceFileName}` : ''}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {isViewMode ? (
                <button
                  onClick={() => navigate(`/teacher/exam/edit/${examId}`)}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                >
                  Mở để chỉnh sửa
                </button>
              ) : (
                <>
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                    Có thể bấm `AI giải câu này` tại từng câu để tự điền đáp án và lời giải.
                  </div>
                  <button
                    onClick={handleCreateExam}
                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 inline-flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Tạo đề từ bản đã rà soát
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Lỗi cần xem lại</div>
            <div className="mt-2 text-3xl font-black text-rose-600">{warningSummary.errors}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Cảnh báo</div>
            <div className="mt-2 text-3xl font-black text-amber-500">{warningSummary.warnings}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Ghi chú AI</div>
            <div className="mt-2 text-3xl font-black text-sky-600">{warningSummary.info}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">Thông tin đề thi</h2>
            <p className="mt-1 text-sm text-slate-500">Kiểm tra lại tiêu đề, mô tả, hướng dẫn và các thông số chính trước khi tạo đề.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <MetadataField label="Tên đề thi" value={title} onChange={setTitle} readOnly={isViewMode} />
            <MetadataField label="Môn học" value={subject} onChange={setSubject} readOnly={isViewMode} />
            <MetadataField label="Khối lớp" value={grade} onChange={setGrade} readOnly={isViewMode} />
            <MetadataField label="Loại đề" value={templateType} onChange={(value) => setTemplateType(value as ExamTemplateType)} readOnly={isViewMode} />
            <MetadataField label="Thời gian (phút)" value={durationMinutes} onChange={(value) => setDurationMinutes(Number(value) || 50)} readOnly={isViewMode} />
            <MetadataField label="Tổng điểm" value={totalScore} onChange={(value) => setTotalScore(Number(value) || 10)} readOnly={isViewMode} />
            <MetadataField label="Số lần làm tối đa" value={maxAttempts} onChange={(value) => setMaxAttempts(Number(value) || 1)} readOnly={isViewMode} />
          </div>

          <MetadataField label="Mô tả" value={description} onChange={setDescription} readOnly={isViewMode} textarea />
          <MetadataField label="Hướng dẫn làm bài" value={instructions} onChange={setInstructions} readOnly={isViewMode} textarea />
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-xl font-black text-slate-900">Phần I: Trắc nghiệm</h2>
                <p className="text-sm text-slate-500">Xem lại câu hỏi, 4 phương án và đáp án đúng.</p>
              </div>
            </div>

            {sortNumericEntries(part1Data).map(([qNum, question]) => (
              <div key={qNum} className="rounded-2xl border border-slate-200 p-5 bg-slate-50/70 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Câu {qNum}</div>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={() => solvePart1Question(qNum, question)}
                      disabled={solvingQuestionKey === `P1-${qNum}`}
                      className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {solvingQuestionKey === `P1-${qNum}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      AI giải câu này
                    </button>
                  )}
                </div>
                <RichContentField
                  label="Nội dung câu hỏi"
                  value={question.question || ''}
                  readOnly={isViewMode}
                  onChange={(value) => updatePart1(qNum, (current) => ({ ...current, question: value }))}
                  placeholder="Nhập nội dung câu hỏi..."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {(['A', 'B', 'C', 'D'] as const).map((choiceKey) => (
                    <RichContentField
                      key={choiceKey}
                      label={`Đáp án ${choiceKey}`}
                      value={question.choices?.[choiceKey] || ''}
                      readOnly={isViewMode}
                      onChange={(value) => updatePart1(qNum, (current) => ({
                        ...current,
                        choices: {
                          ...(current.choices || {}),
                          [choiceKey]: value,
                        },
                      }))}
                      placeholder={`Nhập nội dung đáp án ${choiceKey}...`}
                      className="h-24 mb-12"
                    />
                  ))}
                </div>
                <MetadataField
                  label="Đáp án đúng"
                  value={question.answer || ''}
                  onChange={(value) => updatePart1(qNum, (current) => ({ ...current, answer: value.toUpperCase().trim() }))}
                  readOnly={isViewMode}
                />
                <RichContentField
                  label="Lời giải chi tiết"
                  value={question.explanation || ''}
                  readOnly={isViewMode}
                  onChange={(value) => updatePart1(qNum, (current) => ({ ...current, explanation: value }))}
                  placeholder="Nhập lời giải chi tiết..."
                  className="h-24 mb-12"
                />
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-xl font-black text-slate-900">Phần II: Đúng / Sai</h2>
                <p className="text-sm text-slate-500">Kiểm tra từng ý a, b, c, d và gán đúng hoặc sai.</p>
              </div>
            </div>

            {sortNumericEntries(part2Data).map(([qNum, question]) => (
              <div key={qNum} className="rounded-2xl border border-slate-200 p-5 bg-slate-50/70 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Câu {qNum}</div>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={() => solvePart2Question(qNum, question)}
                      disabled={solvingQuestionKey === `P2-${qNum}`}
                      className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {solvingQuestionKey === `P2-${qNum}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      AI giải câu này
                    </button>
                  )}
                </div>
                <RichContentField
                  label="Nội dung câu hỏi"
                  value={question.question || ''}
                  readOnly={isViewMode}
                  onChange={(value) => updatePart2(qNum, (current) => ({ ...current, question: value }))}
                  placeholder="Nhập nội dung câu hỏi..."
                />
                {(Object.entries(question.statements || {}) as Array<[string, string]>).map(([statementKey, statementValue]) => (
                  <div key={statementKey} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <RichContentField
                      label={`Ý ${statementKey}`}
                      value={statementValue || ''}
                      readOnly={isViewMode}
                      onChange={(value) => updatePart2(qNum, (current) => ({
                        ...current,
                        statements: {
                          ...(current.statements || {}),
                          [statementKey]: value,
                        },
                      }))}
                      placeholder={`Nhập nội dung ý ${statementKey}...`}
                      className="h-24 mb-12"
                    />
                    <MetadataField
                      label={`Đáp án ý ${statementKey}`}
                      value={question.answers?.[statementKey] === undefined ? '' : question.answers?.[statementKey] ? 'DUNG' : 'SAI'}
                      onChange={(value) => updatePart2(qNum, (current) => ({
                        ...current,
                        answers: {
                          ...(current.answers || {}),
                          [statementKey]: value.trim().toUpperCase() === 'DUNG',
                        },
                      }))}
                      readOnly={isViewMode}
                    />
                    {!isViewMode && (
                      <RichContentField
                        label={`Lời giải ý ${statementKey}`}
                        value={question.explanations?.[statementKey]?.explanation || ''}
                        readOnly={false}
                        onChange={(value) => updatePart2(qNum, (current) => ({
                          ...current,
                          explanations: {
                            ...(current.explanations || {}),
                            [statementKey]: {
                              ...(current.explanations?.[statementKey] || {}),
                              explanation: value,
                            },
                          },
                        }))}
                        placeholder={`Nhập lời giải cho ý ${statementKey}...`}
                        className="h-24 mb-12"
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-violet-600" />
              <div>
                <h2 className="text-xl font-black text-slate-900">Phần III: Trả lời ngắn</h2>
                <p className="text-sm text-slate-500">Kiểm tra nội dung câu và đáp án ngắn.</p>
              </div>
            </div>

            {sortNumericEntries(part3Data).map(([qNum, question]) => (
              <div key={qNum} className="rounded-2xl border border-slate-200 p-5 bg-slate-50/70 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Câu {qNum}</div>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={() => solvePart3Question(qNum, question)}
                      disabled={solvingQuestionKey === `P3-${qNum}`}
                      className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {solvingQuestionKey === `P3-${qNum}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      AI giải câu này
                    </button>
                  )}
                </div>
                <RichContentField
                  label="Nội dung câu hỏi"
                  value={question.question || ''}
                  readOnly={isViewMode}
                  onChange={(value) => updatePart3(qNum, (current) => ({ ...current, question: value }))}
                  placeholder="Nhập nội dung câu hỏi..."
                />
                <MetadataField
                  label="Đáp án"
                  value={question.answer || ''}
                  onChange={(value) => updatePart3(qNum, (current) => ({ ...current, answer: value }))}
                  readOnly={isViewMode}
                />
                <RichContentField
                  label="Lời giải"
                  value={question.explanation || ''}
                  readOnly={isViewMode}
                  onChange={(value) => updatePart3(qNum, (current) => ({ ...current, explanation: value }))}
                  placeholder="Nhập lời giải..."
                  className="h-24 mb-12"
                />
              </div>
            ))}
          </section>
        </div>

        {warnings.length > 0 && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm space-y-4">
            <button
              type="button"
              onClick={() => setShowWarnings((prev) => !prev)}
              className="w-full flex items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-3 text-amber-900">
                <FileWarning className="w-5 h-5" />
                <div>
                  <div className="font-black">Cảnh báo sau khi import</div>
                  <div className="text-sm text-amber-800">Bạn có thể mở danh sách này để rà nhanh các câu cần kiểm tra lại.</div>
                </div>
              </div>
              <div className="text-sm font-bold text-amber-900">
                {showWarnings ? 'Thu gọn' : `Xem ${warnings.length} cảnh báo`}
              </div>
            </button>

            {showWarnings && (
              <div className="grid gap-2">
                {warnings.map((warning) => (
                  <div
                    key={warning.id}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-sm',
                      warning.level === 'error' && 'border-rose-200 bg-rose-50 text-rose-800',
                      warning.level === 'warning' && 'border-amber-200 bg-white text-amber-800',
                      warning.level === 'info' && 'border-sky-200 bg-sky-50 text-sky-800',
                    )}
                  >
                    <span className="font-bold">{warning.questionRef ? `${warning.questionRef}: ` : ''}</span>
                    {warning.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
