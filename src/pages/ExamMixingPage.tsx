import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Shuffle, Layers3, Eye, Save, Sparkles, CheckCircle2, FileArchive } from 'lucide-react';
import { store } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { Exam, ExamMixingSettings, ExamVersion } from '@/types';
import { generateExamVersions } from '@/lib/examVersioning';
import { cn } from '@/lib/utils';
import { exportMixedVersionsZip } from '@/lib/wordExport';

interface ExamMixingPageProps {
  mode?: 'EXAM' | 'SHEET';
}

export default function ExamMixingPage({ mode = 'EXAM' }: ExamMixingPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [savedVersions, setSavedVersions] = useState<ExamVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [alertMessage, setAlertMessage] = useState('');
  const [editingVersionId, setEditingVersionId] = useState<string>('');
  const [editingDraft, setEditingDraft] = useState<ExamVersion | null>(null);

  const [config, setConfig] = useState<ExamMixingSettings>({
    enabled: true,
    versionCount: 4,
    codeStyle: 'ALPHA',
    shuffleQuestions: true,
    shuffleChoices: true,
    keepPartOrder: true,
    shuffleWithinPartOnly: true,
    keepPart3Fixed: true,
  });
  const isSheetMode = mode === 'SHEET';

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      const examData = await store.getExamById(id);
      const params = new URLSearchParams(location.search);
      const requestedCount = Number(params.get('count') || '');
      const requestedCodeStyle = params.get('codeStyle');
      if (examData) {
        const isLegacySheet = examData.templateType === 'LEGACY_PHIU_TRA_LOI';
        const normalizedRequestedCount = Number.isFinite(requestedCount) && requestedCount > 0
          ? Math.max(1, Math.min(20, Math.floor(requestedCount)))
          : undefined;
        setExam(examData);
        setConfig({
          enabled: examData.mixingSettings?.enabled ?? true,
          versionCount: normalizedRequestedCount || examData.mixingSettings?.versionCount || 4,
          codeStyle: (requestedCodeStyle === 'NUMERIC' || requestedCodeStyle === 'ALPHA')
            ? (requestedCodeStyle as ExamMixingSettings['codeStyle'])
            : (examData.mixingSettings?.codeStyle || (isLegacySheet || isSheetMode ? 'NUMERIC' : 'ALPHA')),
          shuffleQuestions: examData.mixingSettings?.shuffleQuestions ?? !isSheetMode,
          shuffleChoices: examData.mixingSettings?.shuffleChoices ?? !isSheetMode,
          keepPartOrder: examData.mixingSettings?.keepPartOrder ?? true,
          shuffleWithinPartOnly: examData.mixingSettings?.shuffleWithinPartOnly ?? true,
          keepPart3Fixed: examData.mixingSettings?.keepPart3Fixed ?? true,
        });
      }
      setIsLoading(false);
    };
    load();
  }, [id, location.search]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = store.subscribeToExamVersions(setSavedVersions, id);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    if (!editingVersionId) {
      setEditingDraft(null);
      return;
    }
    const version = savedVersions.find(v => v.id === editingVersionId);
    if (version) {
      setEditingDraft(JSON.parse(JSON.stringify(version)));
    } else {
      setEditingDraft(null);
    }
  }, [editingVersionId, savedVersions]);

  const previewVersions = useMemo(() => {
    if (!exam || !userProfile?.uid) return [];
    return generateExamVersions(exam, userProfile.uid, config);
  }, [exam, userProfile?.uid, config]);

  const activePreview = previewVersions[previewIndex] || previewVersions[0] || null;

  const handleGenerateAndSave = async () => {
    if (!exam || !userProfile?.uid) return;
    setIsSaving(true);
    setAlertMessage('');

    try {
      const generated = generateExamVersions(exam, userProfile.uid, config);
      await store.replaceExamVersions(exam.id, generated);
      await store.saveExam({
        ...exam,
        mixingSettings: config,
        updatedAt: Date.now(),
      });
      setSavedVersions(generated);
      setAlertMessage(`Đã sinh ${generated.length} mã đề và lưu mapping thành công.`);
    } catch (error) {
      console.error(error);
      setAlertMessage('Không thể sinh mã đề. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEditedVersion = async () => {
    if (!editingDraft) return;
    setIsSaving(true);
    setAlertMessage('');
    try {
      await store.saveExamVersion(editingDraft);
      setAlertMessage(`Đã lưu mã đề ${editingDraft.code} cùng đáp án/lời giải chi tiết.`);
    } catch (error) {
      console.error(error);
      setAlertMessage('Không thể lưu mã đề đã chỉnh sửa. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportZip = async () => {
    const versionsToExport = savedVersions.length > 0 ? savedVersions : previewVersions;
    if (!versionsToExport.length) {
      setAlertMessage('Chưa có mã đề để xuất ZIP. Hãy sinh mã đề trước.');
      return;
    }

    try {
      await exportMixedVersionsZip({
        originalExam: exam,
        versions: versionsToExport,
      });
      setAlertMessage(`Đã xuất ZIP gồm ${versionsToExport.length} mã đề và đáp án tương ứng.`);
    } catch (error) {
      console.error(error);
      setAlertMessage('Không thể xuất file ZIP. Vui lòng thử lại.');
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Đang tải cấu hình trộn đề...</div>;
  }

  if (!exam) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Không tìm thấy đề gốc.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate('/teacher')} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <Shuffle className="w-3.5 h-3.5" />
                {isSheetMode ? 'Printed Sheet Codes' : 'Multiple Exam Versions'}
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-3">
                {isSheetMode ? 'Thiết lập mã phiếu (đề in giấy)' : 'Cấu hình trộn đề'}
              </h1>
              <p className="text-slate-500 mt-2">
                {isSheetMode
                  ? 'Tạo các mã phiếu 4 số và nhập đáp án/lời giải chi tiết cho từng mã theo 3 phần.'
                  : 'Sinh nhiều mã đề từ đề gốc, lưu mapping chuyên nghiệp để vẫn dùng lại logic chấm điểm cũ 100%.'}
              </p>
              <div className="mt-3 text-sm text-slate-700 font-semibold">{exam.title}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportZip}
              className="px-5 py-3 rounded-2xl border border-blue-200 bg-white text-blue-700 font-bold hover:bg-blue-50 inline-flex items-center gap-2"
            >
              <FileArchive className="w-4 h-4" />
              Xuất ZIP đề + đáp án
            </button>
            <button
              onClick={handleGenerateAndSave}
              disabled={isSaving}
              className="px-5 py-3 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang sinh mã đề...' : 'Sinh mã đề'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {isSheetMode ? 'Tùy chọn mã phiếu' : 'Tùy chọn trộn đề'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {isSheetMode
                    ? 'Thiết lập số lượng mã phiếu 4 số và lưu để nhập đáp án/lời giải theo từng mã.'
                    : 'Thiết lập số mã đề và chiến lược shuffle theo chuẩn hệ thống thi online.'}
                </p>
              </div>

              {!isSheetMode && (
                <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                  <div>
                    <div className="font-bold text-slate-900">Bật tính năng trộn đề</div>
                    <div className="text-sm text-slate-500">Tạo nhiều mã đề từ đề gốc hiện tại.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.enabled ?? true}
                    onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Số lượng mã đề</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={config.versionCount || 4}
                    onChange={(e) => setConfig(prev => ({ ...prev, versionCount: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Kiểu mã đề</label>
                  <select
                    value={config.codeStyle}
                    onChange={(e) => setConfig(prev => ({ ...prev, codeStyle: e.target.value as ExamMixingSettings['codeStyle'] }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                    disabled={isSheetMode}
                  >
                    <option value="ALPHA">A, B, C, D...</option>
                    <option value="NUMERIC">0001, 0002, 0003...</option>
                  </select>
                </div>
              </div>

              {!isSheetMode && <div className="space-y-3">
                {[
                  {
                    key: 'shuffleQuestions',
                    label: 'Trộn thứ tự câu hỏi',
                    description: 'Phần I, II, III đều đảo thứ tự câu nhưng vẫn giữ cấu trúc ba phần.',
                  },
                  {
                    key: 'shuffleChoices',
                    label: 'Trộn đáp án và các ý trong câu',
                    description: 'Phần I đảo A/B/C/D. Phần II đảo các ý a/b/c/d và cập nhật mapping để chấm đúng.',
                  },
                  {
                    key: 'keepPart3Fixed',
                    label: 'Không trộn phần trả lời ngắn',
                    description: 'Nếu tắt mục này, Phần III sẽ đảo các câu; nếu bật, phần III giữ nguyên.',
                  },
                ].map((item) => (
                  <label key={item.key} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={(config as any)[item.key] ?? false}
                      onChange={(e) => setConfig(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    />
                    <div>
                      <div className="font-bold text-slate-900">{item.label}</div>
                      <div className="text-sm text-slate-500">{item.description}</div>
                    </div>
                  </label>
                ))}
              </div>}

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <div className="font-bold mb-1">Nguyên tắc chấm điểm đang dùng</div>
                Hệ thống lưu mapping `câu gốc / câu sau trộn / đáp án trước-sau`, sau đó map ngược về đề gốc trước khi gọi engine chấm điểm cũ.
              </div>

              {!isSheetMode && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-bold mb-2">Cách trộn hiện tại</div>
                <div>Phần 1: Đảo câu và đảo đáp án.</div>
                <div>Phần 2: Đảo câu và đảo các ý a/b/c/d.</div>
                <div>Phần 3: Đảo các câu.</div>
              </div>}

              {alertMessage && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 inline-flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{alertMessage}</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 text-slate-900 font-black">
                <Layers3 className="w-5 h-5 text-blue-600" />
                Mã đề đã lưu
              </div>
              <div className="mt-4 space-y-3">
                {savedVersions.length === 0 ? (
                  <div className="text-sm text-slate-500">Chưa có mã đề nào được sinh.</div>
                ) : (
                  savedVersions.map((version) => (
                    <div key={version.id} className="rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">Mã đề {version.code}</div>
                        <div className="text-xs text-slate-500">{version.mappings.length} mapping | {new Date(version.createdAt).toLocaleString('vi-VN')}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreviewIndex(previewVersions.findIndex(item => item.code === version.code))}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          Xem
                        </button>
                        <button
                          onClick={() => setEditingVersionId(version.id)}
                          className="px-3 py-2 rounded-xl border border-emerald-300 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                        >
                          Sửa đáp án/Lời giải
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-slate-900 font-black">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Preview mã đề
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Mỗi mã đề được tạo từ cùng một đề gốc nhưng có thứ tự câu / đáp án khác nhau.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {previewVersions.map((version, index) => (
                    <button
                      key={version.id}
                      onClick={() => setPreviewIndex(index)}
                      className={cn(
                        "px-3 py-2 rounded-xl border text-sm font-bold transition-colors",
                        activePreview?.id === version.id
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {version.code}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {activePreview && (
              <>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                  <div className="text-lg font-black text-slate-900">Mã đề {activePreview.code}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Phần I</div>
                      <div className="mt-2 text-sm text-slate-700">{Object.keys(activePreview.derivedExam.part1).length} câu đã mix đáp án</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Phần II</div>
                      <div className="mt-2 text-sm text-slate-700">{Object.keys(activePreview.derivedExam.part2).length} câu đúng/sai</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Phần III</div>
                      <div className="mt-2 text-sm text-slate-700">{Object.keys(activePreview.derivedExam.part3).length} câu trả lời ngắn</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-black text-slate-900">Mapping câu hỏi và đáp án</h3>
                    <p className="text-sm text-slate-500 mt-1">Dữ liệu này được lưu lại để phục vụ chấm điểm đúng 100% và xem lại bài làm.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-white text-slate-500">
                          <th className="p-4 font-bold uppercase tracking-wider text-xs">Phần</th>
                          <th className="p-4 font-bold uppercase tracking-wider text-xs">Câu gốc</th>
                          <th className="p-4 font-bold uppercase tracking-wider text-xs">Câu sau trộn</th>
                          <th className="p-4 font-bold uppercase tracking-wider text-xs">Đáp án</th>
                          <th className="p-4 font-bold uppercase tracking-wider text-xs">Mapping A/B/C/D</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {activePreview.mappings.map((mapping) => (
                          <tr key={`${mapping.part}-${mapping.versionQuestionNumber}`} className="hover:bg-slate-50">
                            <td className="p-4 font-bold text-slate-900">Phần {mapping.part}</td>
                            <td className="p-4 text-slate-700">{mapping.originalQuestionNumber}</td>
                            <td className="p-4 text-slate-700">{mapping.versionQuestionNumber}</td>
                            <td className="p-4 text-slate-700">
                              {mapping.originalCorrectAnswer || '--'}
                              {mapping.shuffledCorrectAnswer ? ` -> ${mapping.shuffledCorrectAnswer}` : ''}
                            </td>
                            <td className="p-4 text-xs text-slate-500">
                              {mapping.choiceMappings?.length
                                ? mapping.choiceMappings.map(item => `${item.originalChoice}->${item.shuffledChoice}`).join(' | ')
                                : 'Giữ nguyên'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {editingDraft && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="text-lg font-black text-slate-900">Chỉnh sửa mã đề {editingDraft.code}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingVersionId('')}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={handleSaveEditedVersion}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Đang lưu...' : 'Lưu mã đề'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 font-bold text-slate-900">Phần I - Trắc nghiệm A/B/C/D</div>
                  <div className="divide-y divide-slate-200">
                    {Object.entries(editingDraft.derivedExam.part1).map(([qNo, data]) => (
                      <div key={qNo} className="p-4 grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3">
                        <div className="text-sm text-slate-500 font-bold">Câu {qNo}</div>
                        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Đáp án đúng</label>
                            <input
                              type="text"
                              value={(data as any).answer || ''}
                              onChange={(e) => {
                                const value = e.target.value.toUpperCase().trim();
                                setEditingDraft(prev => {
                                  if (!prev) return prev;
                                  const next = { ...prev };
                                  (next.derivedExam.part1 as any)[qNo] = { ...(data as any), answer: value };
                                  return next;
                                });
                              }}
                              placeholder="A/B/C/D"
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Lời giải chi tiết</label>
                            <textarea
                              rows={2}
                              value={(data as any).explanation || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditingDraft(prev => {
                                  if (!prev) return prev;
                                  const next = { ...prev };
                                  (next.derivedExam.part1 as any)[qNo] = { ...(data as any), explanation: value };
                                  return next;
                                });
                              }}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden mt-6">
                  <div className="p-4 bg-slate-50 font-bold text-slate-900">Phần II - Đúng/Sai (a/b/c/d)</div>
                  <div className="divide-y divide-slate-200">
                    {Object.entries(editingDraft.derivedExam.part2).map(([qNo, data]) => {
                      const typed: any = data as any;
                      const answers: Record<string, boolean> = typed.answers || {};
                      const explanations: Record<string, any> = typed.explanations || {};

                      return (
                        <div key={qNo} className="p-4 space-y-4">
                          <div className="text-sm text-slate-500 font-bold">Câu {qNo}</div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(['a', 'b', 'c', 'd'] as const).map((sub) => {
                              const subExp = explanations[sub] || {};
                              const current = answers[sub];

                              return (
                                <div key={sub} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/40">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-bold text-slate-800">Ý {sub})</div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDraft((prev) => {
                                            if (!prev) return prev;
                                            const next = { ...prev };
                                            const nextQ = { ...(next.derivedExam.part2 as any)[qNo] };
                                            const nextAnswers = { ...(nextQ.answers || {}) };
                                            nextAnswers[sub] = true;
                                            (next.derivedExam.part2 as any)[qNo] = { ...nextQ, answers: nextAnswers };
                                            return next;
                                          });
                                        }}
                                        className={cn(
                                          "px-3 py-1.5 rounded-xl text-xs font-black border",
                                          current === true ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300 hover:bg-emerald-50"
                                        )}
                                      >
                                        ĐÚNG
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDraft((prev) => {
                                            if (!prev) return prev;
                                            const next = { ...prev };
                                            const nextQ = { ...(next.derivedExam.part2 as any)[qNo] };
                                            const nextAnswers = { ...(nextQ.answers || {}) };
                                            nextAnswers[sub] = false;
                                            (next.derivedExam.part2 as any)[qNo] = { ...nextQ, answers: nextAnswers };
                                            return next;
                                          });
                                        }}
                                        className={cn(
                                          "px-3 py-1.5 rounded-xl text-xs font-black border",
                                          current === false ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-700 border-slate-300 hover:bg-rose-50"
                                        )}
                                      >
                                        SAI
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Lời giải chi tiết</label>
                                    <textarea
                                      rows={2}
                                      value={subExp.explanation || ''}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setEditingDraft((prev) => {
                                          if (!prev) return prev;
                                          const next = { ...prev };
                                          const nextQ = { ...(next.derivedExam.part2 as any)[qNo] };
                                          const nextExps = { ...(nextQ.explanations || {}) };
                                          nextExps[sub] = { ...(nextExps[sub] || {}), explanation: value };
                                          (next.derivedExam.part2 as any)[qNo] = { ...nextQ, explanations: nextExps };
                                          return next;
                                        });
                                      }}
                                      className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                                      placeholder="Nhập lời giải cho ý này..."
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden mt-6">
                  <div className="p-4 bg-slate-50 font-bold text-slate-900">Phần III - Trả lời ngắn</div>
                  <div className="divide-y divide-slate-200">
                    {Object.entries(editingDraft.derivedExam.part3).map(([qNo, data]) => (
                      <div key={qNo} className="p-4 grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3">
                        <div className="text-sm text-slate-500 font-bold">Câu {qNo}</div>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Đáp án</label>
                            <input
                              type="text"
                              value={(data as any).answer || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditingDraft(prev => {
                                  if (!prev) return prev;
                                  const next = { ...prev };
                                  (next.derivedExam.part3 as any)[qNo] = { ...(data as any), answer: value };
                                  return next;
                                });
                              }}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Lời giải chi tiết</label>
                            <textarea
                              rows={2}
                              value={(data as any).explanation || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditingDraft(prev => {
                                  if (!prev) return prev;
                                  const next = { ...prev };
                                  (next.derivedExam.part3 as any)[qNo] = { ...(data as any), explanation: value };
                                  return next;
                                });
                              }}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
