import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Layers3, FileArchive, CheckCircle2, ShieldCheck, Upload, Download } from 'lucide-react';
import { store } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { Exam, ExamVersion } from '@/types';
import { generateExamVersions } from '@/lib/examVersioning';
import { exportMixedVersionsZip } from '@/lib/wordExport';
import { downloadMixingAnswerKeyTemplate } from '@/lib/wordMixingTemplate';
import { parseMixingAnswerKeyWordFile } from '@/lib/wordMixingImport';
import { cn } from '@/lib/utils';
import { RichTextDisplay } from '@/components/RichTextDisplay';

function toPreviewHtml(text: string) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

function getFirstNumericKey(record: Record<number, any>) {
  return Object.keys(record)
    .map(Number)
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b)[0];
}

function getQuickPreview(version: ExamVersion) {
  const p1Key = getFirstNumericKey(version.derivedExam.part1 || {});
  const p2Key = getFirstNumericKey(version.derivedExam.part2 || {});
  const p3Key = getFirstNumericKey(version.derivedExam.part3 || {});

  const p1 = p1Key ? (version.derivedExam.part1 as any)[p1Key] : null;
  const p2 = p2Key ? (version.derivedExam.part2 as any)[p2Key] : null;
  const p3 = p3Key ? (version.derivedExam.part3 as any)[p3Key] : null;
  const p2FirstSub = p2?.answers ? (['a', 'b', 'c', 'd'].find((s) => p2.answers[s] !== undefined) || 'a') : 'a';

  return {
    part1: p1 ? `Câu ${p1Key}: ${p1.answer || '--'}${p1.explanation ? ` | ${p1.explanation}` : ''}` : 'Chưa có dữ liệu Phần I',
    part2: p2
      ? `Câu ${p2Key} ý ${p2FirstSub}: ${p2.answers?.[p2FirstSub] === true ? 'ĐÚNG' : p2.answers?.[p2FirstSub] === false ? 'SAI' : '--'}${p2.explanations?.[p2FirstSub]?.explanation ? ` | ${p2.explanations[p2FirstSub].explanation}` : ''}`
      : 'Chưa có dữ liệu Phần II',
    part3: p3 ? `Câu ${p3Key}: ${p3.answer || '--'}${p3.explanation ? ` | ${p3.explanation}` : ''}` : 'Chưa có dữ liệu Phần III',
  };
}

function getSheetFormattedCode(index: number) {
  // Requested format: 1101, 1102, ... (4 digits)
  return String(1101 + index);
}

function applySheetCodeFormat(versions: ExamVersion[], examId: string): ExamVersion[] {
  return versions.map((version, index) => {
    const code = getSheetFormattedCode(index);
    return {
      ...version,
      id: `${examId}_${code}`,
      code,
      derivedExam: {
        ...version.derivedExam,
        id: `${examId}__${code}`,
        title: `${version.derivedExam.title.split(' - Mã đề ')[0]} - Mã đề ${code}`,
      },
    };
  });
}

export default function SheetMixingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { userProfile } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [savedVersions, setSavedVersions] = useState<ExamVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [versionCount, setVersionCount] = useState(4);
  const [isImporting, setIsImporting] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingVersionId, setEditingVersionId] = useState('');
  const [editingDraft, setEditingDraft] = useState<ExamVersion | null>(null);
  const [activePartTab, setActivePartTab] = useState<1 | 2 | 3>(1);
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  // Ref lưu bản mới nhất của savedVersions để useEffect đọc đúng data (tránh stale closure)
  const savedVersionsRef = React.useRef<ExamVersion[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      const examData = await store.getExamById(id);
      const params = new URLSearchParams(location.search);
      const requestedCount = Number(params.get('count') || '');
      const normalizedRequestedCount = Number.isFinite(requestedCount) && requestedCount > 0
        ? Math.max(1, Math.min(48, Math.floor(requestedCount)))
        : undefined;

      if (examData) {
        setExam(examData);
        setVersionCount(normalizedRequestedCount || examData.mixingSettings?.versionCount || 4);
      }
      setIsLoading(false);
    };
    load();
  }, [id, location.search]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = store.subscribeToExamVersions((versions) => {
      setSavedVersions(versions);
      savedVersionsRef.current = versions;
    }, id);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    if (!editingVersionId) {
      setEditingDraft(null);
      return;
    }
    // Đọc từ ref (luôn mới nhất) để tránh race condition với React state update
    const version = savedVersionsRef.current.find((v) => v.id === editingVersionId);
    setEditingDraft(version ? JSON.parse(JSON.stringify(version)) : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingVersionId]);

  const previewVersions = useMemo(() => {
    if (!exam || !userProfile?.uid) return [];
    const generated = generateExamVersions(exam, userProfile.uid, {
      enabled: true,
      versionCount,
      codeStyle: 'NUMERIC',
      shuffleQuestions: false,
      shuffleChoices: false,
      keepPartOrder: true,
      shuffleWithinPartOnly: true,
      keepPart3Fixed: true,
    });
    return applySheetCodeFormat(generated, exam.id);
  }, [exam, userProfile?.uid, versionCount]);

  const handleGenerateAndSave = async () => {
    if (!exam || !userProfile?.uid) return;

    // SAFETY: Warn before wiping existing answer data
    if (savedVersions.length > 0) {
      const hasAnswers = savedVersions.some((v) => {
        const p1 = Object.values(v.derivedExam.part1 || {}).some((q: any) => q?.answer);
        const p2 = Object.values(v.derivedExam.part2 || {}).some((q: any) => Object.keys(q?.answers || {}).length > 0);
        const p3 = Object.values(v.derivedExam.part3 || {}).some((q: any) => q?.answer);
        return p1 || p2 || p3;
      });
      if (hasAnswers) {
        const confirmed = window.confirm(
          `⚠️ CẢNH BÁO: Bạn đã nhập đáp án/lời giải cho ${savedVersions.length} mã phiếu.\n\nBấm "Tạo mã phiếu" lại sẽ XÓA TOÀN BỘ đáp án đã nhập và tạo lại từ đầu!\n\nBấm OK nếu bạn thực sự muốn tạo lại, Cancel để giữ nguyên.`
        );
        if (!confirmed) return;
      }
    }

    setIsSaving(true);
    setAlertMessage('');

    try {
      const generatedRaw = generateExamVersions(exam, userProfile.uid, {
        enabled: true,
        versionCount,
        codeStyle: 'NUMERIC',
        shuffleQuestions: false,
        shuffleChoices: false,
        keepPartOrder: true,
        shuffleWithinPartOnly: true,
        keepPart3Fixed: true,
      });
      const generated = applySheetCodeFormat(generatedRaw, exam.id);
      await store.replaceExamVersions(exam.id, generated);
      await store.saveExam({
        ...exam,
        mixingSettings: {
          enabled: true,
          versionCount,
          codeStyle: 'NUMERIC',
          shuffleQuestions: false,
          shuffleChoices: false,
          keepPartOrder: true,
          shuffleWithinPartOnly: true,
          keepPart3Fixed: true,
        },
        updatedAt: Date.now(),
      });
      setSavedVersions(generated);
      // Cập nhật ref ngay lập tức để useEffect([editingVersionId]) đọc đúng data
      savedVersionsRef.current = generated;
      if (generated.length > 0) {
        // Đặt editingDraft trực tiếp thay vì dựa vào useEffect để tránh race condition
        setEditingDraft(JSON.parse(JSON.stringify(generated[0])));
        setEditingVersionId(generated[0].id);
      }
      setAlertMessage(`Đã tạo ${generated.length} mã phiếu 4 số. Hãy nhập đáp án và bấm "Lưu tất cả" khi xong.`);
    } catch (error) {
      console.error(error);
      setAlertMessage('Không thể tạo mã phiếu. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllVersions = async () => {
    if (!savedVersions.length) {
      setAlertMessage('Chưa có mã phiếu nào để lưu. Hãy tạo mã phiếu trước.');
      return;
    }
    setIsSaving(true);
    setAlertMessage('');
    try {
      // Merge editingDraft vào savedVersions trước khi lưu tất cả
      const versionsToSave = savedVersions.map((v) =>
        editingDraft && editingDraft.id === v.id ? editingDraft : v
      );
      await Promise.all(versionsToSave.map((v) => store.saveExamVersion(v)));
      // Cập nhật lại local state để tránh realtime sub ghi đè dữ liệu cũ
      setSavedVersions(versionsToSave);
      setAlertMessage(`✅ Đã lưu đáp án/lời giải cho tất cả ${versionsToSave.length} mã phiếu lên Firebase.`);
    } catch (error) {
      console.error(error);
      setAlertMessage('Lỗi khi lưu tất cả mã phiếu. Vui lòng thử lại.');
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
      // Cập nhật lại savedVersions local để đồng bộ với draft đã lưu
      setSavedVersions((prev) =>
        prev.map((v) => (v.id === editingDraft.id ? JSON.parse(JSON.stringify(editingDraft)) : v))
      );
      setAlertMessage(`✅ Đã lưu đáp án/lời giải cho mã ${editingDraft.code}.`);
    } catch (error) {
      console.error(error);
      setAlertMessage('Không thể lưu mã phiếu đã chỉnh sửa.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportZip = async () => {
    const versionsToExport = savedVersions.length > 0 ? savedVersions : previewVersions;
    if (!versionsToExport.length) {
      setAlertMessage('Chưa có mã phiếu để xuất ZIP.');
      return;
    }
    try {
      await exportMixedVersionsZip({ originalExam: exam, versions: versionsToExport });
      setAlertMessage(`Đã xuất ZIP ${versionsToExport.length} mã phiếu.`);
    } catch (error) {
      console.error(error);
      setAlertMessage('Không thể xuất ZIP.');
    }
  };

  const toggleExplanation = (id: string) => {
    setExpandedExplanation((prev) => (prev === id ? null : id));
  };

  const handleDownloadWordTemplate = async () => {
    const versionsToExport = savedVersions.length > 0 ? savedVersions : previewVersions;
    if (!versionsToExport.length) {
      setAlertMessage('Chưa có mã phiếu. Hãy ấn tạo trước.');
      return;
    }
    try {
      await downloadMixingAnswerKeyTemplate(versionsToExport);
      setAlertMessage('Đã tải mẫu Word thành công. Hãy nhập và upload lại.');
    } catch (e) {
      console.error(e);
      setAlertMessage('Lỗi tải file mẫu.');
    }
  };

  const handleWordImportChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (savedVersions.length === 0) {
      setAlertMessage('Chưa có mã phiếu để nhận import. Hãy bấm "Tạo mã phiếu" trước.');
      return;
    }

    setIsImporting(true);
    setAlertMessage('');
    try {
      const updatedVersions = await parseMixingAnswerKeyWordFile(file, savedVersions);
      await Promise.all(updatedVersions.map((v) => store.saveExamVersion(v)));
      
      setSavedVersions(updatedVersions);
      savedVersionsRef.current = updatedVersions;

      if (editingDraft) {
        const found = updatedVersions.find(v => v.id === editingDraft.id);
        if (found) setEditingDraft(JSON.parse(JSON.stringify(found)));
      }

      setAlertMessage(`✅ Đã import đáp án từ Word cho ${updatedVersions.length} mã thành công.`);
    } catch (err: any) {
      console.error(err);
      setAlertMessage('Lỗi khi đọc file Word: ' + (err.message || 'vui lòng thử lại'));
    } finally {
      setIsImporting(false);
      // Reset input value to allow selecting the same file again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Đang tải trang phiếu...</div>;
  }
  if (!exam) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Không tìm thấy phiếu gốc.</div>;
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
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
                Printed Sheet Workspace
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-3">Trang nhập đáp án Phiếu (riêng)</h1>
              <p className="text-slate-500 mt-2">Mã phiếu 4 số, nhập đáp án đúng và lời giải chi tiết cho từng mã theo 3 phần.</p>
              <div className="mt-2 text-sm font-semibold text-slate-700">{exam.title}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input 
              type="file" 
              accept=".docx" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleWordImportChanged} 
            />
            {savedVersions.length > 0 && (
              <>
                <button
                  onClick={handleDownloadWordTemplate}
                  className="px-5 py-3 rounded-2xl border border-blue-200 bg-white text-blue-700 font-bold hover:bg-blue-50 inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Tải mẫu Word
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="px-5 py-3 rounded-2xl border border-double border-emerald-400 bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isImporting ? 'Đang đọc...' : 'Nhập từ Word'}
                </button>
              </>
            )}
            <button
              onClick={handleExportZip}
              className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 inline-flex items-center gap-2"
            >
              <FileArchive className="w-4 h-4" />
              Xuất ZIP
            </button>
            {savedVersions.length > 0 && (
              <button
                onClick={handleSaveAllVersions}
                disabled={isSaving}
                className="px-5 py-3 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {isSaving ? 'Đang lưu...' : `Lưu tất cả (${savedVersions.length} mã)`}
              </button>
            )}
            <button
              onClick={handleGenerateAndSave}
              disabled={isSaving}
              className="px-5 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang tạo...' : 'Tạo mã phiếu'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">Cấu hình mã phiếu</h2>
                <p className="text-sm text-slate-500 mt-1">Thiết kế riêng cho phiếu in giấy (không trộn online).</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Số lượng mã phiếu</label>
                <input
                  type="number"
                  min={1}
                  max={48}
                  value={versionCount}
                  onChange={(e) => setVersionCount(Math.max(1, Math.min(48, Number(e.target.value) || 1)))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                Mã phiếu được tạo theo định dạng 4 số: 1101, 1102, 1103...
              </div>
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
                Mã phiếu đã lưu
              </div>
              <div className="mt-4 space-y-3">
                {savedVersions.length === 0 ? (
                  <div className="text-sm text-slate-500">Chưa có mã phiếu nào được tạo.</div>
                ) : (
                  savedVersions.map((version) => {
                    const quick = getQuickPreview(version);
                    return (
                    <div key={version.id} className="relative rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">Mã {version.code}</div>
                        <div className="text-xs text-slate-500">{new Date(version.createdAt).toLocaleString('vi-VN')}</div>
                        <div className="text-[11px] text-blue-600 mt-1">Bấm "Xem nhanh" để mở preview cố định</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewVersionId((prev) => (prev === version.id ? null : version.id))}
                          className={cn(
                            "px-3 py-2 rounded-xl border text-sm font-bold",
                            previewVersionId === version.id
                              ? "border-slate-300 text-slate-700 bg-slate-100"
                              : "border-blue-300 text-blue-700 hover:bg-blue-50"
                          )}
                        >
                          {previewVersionId === version.id ? 'Ẩn preview' : 'Xem nhanh'}
                        </button>
                        <button
                          onClick={() => setEditingVersionId(version.id)}
                          className="px-3 py-2 rounded-xl border border-blue-300 text-sm font-bold text-blue-700 hover:bg-blue-50"
                        >
                          Nhập đáp án/lời giải
                        </button>
                      </div>

                      {previewVersionId === version.id && (
                      <div className="absolute left-3 right-3 top-full mt-2 z-20">
                        <div className="rounded-2xl border border-blue-200 bg-white shadow-xl p-4 space-y-3">
                          <div className="text-sm font-black text-slate-900">Preview nhanh mã {version.code}</div>
                          <div className="rounded-xl border border-slate-200 p-2">
                            <div className="text-xs font-bold text-slate-500 mb-1">PHẦN I</div>
                            <RichTextDisplay html={toPreviewHtml(quick.part1)} />
                          </div>
                          <div className="rounded-xl border border-slate-200 p-2">
                            <div className="text-xs font-bold text-slate-500 mb-1">PHẦN II</div>
                            <RichTextDisplay html={toPreviewHtml(quick.part2)} />
                          </div>
                          <div className="rounded-xl border border-slate-200 p-2">
                            <div className="text-xs font-bold text-slate-500 mb-1">PHẦN III</div>
                            <RichTextDisplay html={toPreviewHtml(quick.part3)} />
                          </div>
                        </div>
                      </div>
                      )}
                    </div>
                  )})
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="font-black text-slate-900">Chọn mã đề để nhập</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(savedVersions.length > 0 ? savedVersions : previewVersions).map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={async () => {
                      if (editingDraft && editingVersionId && editingVersionId !== version.id) {
                        const confirmed = window.confirm(
                          `Bạn chưa lưu đáp án mã ${editingDraft.code}.\nBấm OK để lưu trước khi chuyển, Cancel để bỏ qua.`
                        );
                        if (confirmed) {
                          setIsSaving(true);
                          try {
                            await store.saveExamVersion(editingDraft);
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setIsSaving(false);
                          }
                        }
                      }
                      setEditingVersionId(version.id);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-sm font-bold",
                      editingVersionId === version.id
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {version.code}
                  </button>
                ))}
              </div>
            </div>

            {editingDraft && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="text-lg font-black text-slate-900">Nhập đáp án/lời giải cho mã {editingDraft.code}</div>
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
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Đang lưu...' : 'Lưu mã phiếu'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                  {[
                    { id: 1, label: 'PHẦN I (18 Câu)' },
                    { id: 2, label: 'PHẦN II (4 Câu Đ/S)' },
                    { id: 3, label: 'PHẦN III (6 Câu Ngắn)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActivePartTab(tab.id as 1|2|3)}
                      className={cn(
                        "flex-1 py-3 rounded-lg font-bold text-sm transition-all",
                        activePartTab === tab.id
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  {activePartTab === 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {Array.from({ length: 18 }).map((_, i) => {
                        const qNum = i + 1;
                        const id = `p1-${qNum}`;
                        const data: any = (editingDraft.derivedExam.part1 as any)[qNum] || {};
                        const hasExplanation = !!data.explanation;
                        return (
                          <div key={qNum} className="border border-gray-200 p-4 rounded-xl space-y-4">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-black text-lg text-gray-700">Câu {qNum}</span>
                              <button
                                onClick={() => toggleExplanation(id)}
                                className={cn(
                                  "text-sm font-bold px-3 py-1.5 rounded-md transition-colors",
                                  hasExplanation ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"
                                )}
                              >
                                {hasExplanation ? 'Đã có lời giải' : '+ Thêm lời giải'}
                              </button>
                            </div>
                            <div className="space-y-3">
                              {['A', 'B', 'C', 'D'].map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    setEditingDraft((prev) => {
                                      if (!prev) return prev;
                                      const next = JSON.parse(JSON.stringify(prev)) as ExamVersion;
                                      (next.derivedExam.part1 as any)[qNum] = { ...((next.derivedExam.part1 as any)[qNum] || {}), answer: opt };
                                      return next;
                                    });
                                  }}
                                  className={cn(
                                    "w-10 h-10 rounded-full border-2 font-bold",
                                    data.answer === opt
                                      ? "bg-green-500 border-green-500 text-white"
                                      : "border-gray-300 text-gray-600 hover:border-green-400"
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                            {expandedExplanation === id && (
                              <div className="space-y-2">
                                <textarea
                                  rows={2}
                                  value={data.explanation || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setEditingDraft((prev) => {
                                      if (!prev) return prev;
                                      const next = JSON.parse(JSON.stringify(prev)) as ExamVersion;
                                      (next.derivedExam.part1 as any)[qNum] = { ...((next.derivedExam.part1 as any)[qNum] || {}), explanation: value };
                                      return next;
                                    });
                                  }}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                                  placeholder="Lời giải chi tiết"
                                />
                                {data.explanation && (
                                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                                    <div className="text-xs font-bold text-blue-700 mb-1">Xem trước công thức</div>
                                    <RichTextDisplay html={toPreviewHtml(data.explanation)} />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activePartTab === 2 && (
                    <div className="space-y-8">
                      {Array.from({ length: 4 }).map((_, i) => {
                        const qNum = i + 1;
                        const qData: any = (editingDraft.derivedExam.part2 as any)[qNum] || { answers: {} };
                        return (
                          <div key={qNum} className="border border-gray-200 p-6 rounded-xl">
                            <h3 className="font-black text-xl text-gray-800 mb-4">Câu {qNum}</h3>
                            <div className="grid grid-cols-1 gap-4">
                              {['a', 'b', 'c', 'd'].map((sub) => {
                                const subId = `p2-${qNum}-${sub}`;
                                const hasExplanation = !!qData.explanations?.[sub]?.explanation;
                                return (
                                  <div key={sub} className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div className="flex items-center justify-between gap-4">
                                      <button
                                        onClick={() => toggleExplanation(subId)}
                                        className={cn(
                                          "text-sm font-bold px-3 py-1.5 rounded-md transition-colors",
                                          hasExplanation ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"
                                        )}
                                      >
                                        {hasExplanation ? 'Đã có lời giải' : '+ Thêm lời giải'}
                                      </button>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            setEditingDraft((prev) => {
                                              if (!prev) return prev;
                                              const next = JSON.parse(JSON.stringify(prev)) as ExamVersion;
                                              const currentQ = (next.derivedExam.part2 as any)[qNum] || { answers: {} };
                                              currentQ.answers = { ...(currentQ.answers || {}), [sub]: true };
                                              (next.derivedExam.part2 as any)[qNum] = currentQ;
                                              return next;
                                            });
                                          }}
                                          className={cn(
                                            "px-4 py-1.5 rounded-full font-bold text-sm border-2",
                                            qData.answers?.[sub] === true ? "bg-green-500 border-green-500 text-white" : "border-gray-300 text-gray-500"
                                          )}
                                        >
                                          ĐÚNG
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingDraft((prev) => {
                                              if (!prev) return prev;
                                              const next = JSON.parse(JSON.stringify(prev)) as ExamVersion;
                                              const currentQ = (next.derivedExam.part2 as any)[qNum] || { answers: {} };
                                              currentQ.answers = { ...(currentQ.answers || {}), [sub]: false };
                                              (next.derivedExam.part2 as any)[qNum] = currentQ;
                                              return next;
                                            });
                                          }}
                                          className={cn(
                                            "px-4 py-1.5 rounded-full font-bold text-sm border-2",
                                            qData.answers?.[sub] === false ? "bg-red-500 border-red-500 text-white" : "border-gray-300 text-gray-500"
                                          )}
                                        >
                                          SAI
                                        </button>
                                      </div>
                                    </div>
                                    {expandedExplanation === subId && (
                                      <div className="mt-3 space-y-2">
                                        <textarea
                                          rows={2}
                                          value={qData.explanations?.[sub]?.explanation || ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setEditingDraft((prev) => {
                                              if (!prev) return prev;
                                              const next = JSON.parse(JSON.stringify(prev)) as ExamVersion;
                                              const currentQ = (next.derivedExam.part2 as any)[qNum] || { answers: {} };
                                              currentQ.explanations = { ...(currentQ.explanations || {}), [sub]: { ...(currentQ.explanations?.[sub] || {}), explanation: value } };
                                              (next.derivedExam.part2 as any)[qNum] = currentQ;
                                              return next;
                                            });
                                          }}
                                          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                                          placeholder={`Lời giải ý ${sub}`}
                                        />
                                        {qData.explanations?.[sub]?.explanation && (
                                          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                                            <div className="text-xs font-bold text-blue-700 mb-1">Xem trước công thức</div>
                                            <RichTextDisplay html={toPreviewHtml(qData.explanations[sub].explanation)} />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activePartTab === 3 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const qNum = i + 1;
                        const id = `p3-${qNum}`;
                        const data: any = (editingDraft.derivedExam.part3 as any)[qNum] || {};
                        const hasExplanation = !!data.explanation;
                        return (
                          <div key={qNum} className="border border-gray-200 p-5 rounded-xl">
                            <div className="flex justify-between items-center mb-3">
                              <label className="font-black text-lg text-gray-800">Câu {qNum}</label>
                              <button
                                onClick={() => toggleExplanation(id)}
                                className={cn(
                                  "text-sm font-bold px-3 py-1.5 rounded-md transition-colors",
                                  hasExplanation ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:bg-gray-100"
                                )}
                              >
                                {hasExplanation ? 'Đã có lời giải' : '+ Thêm lời giải'}
                              </button>
                            </div>
                            <input
                              type="text"
                              value={data.answer || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditingDraft((prev) => {
                                  if (!prev) return prev;
                                  const next = JSON.parse(JSON.stringify(prev)) as ExamVersion;
                                  (next.derivedExam.part3 as any)[qNum] = { ...((next.derivedExam.part3 as any)[qNum] || {}), answer: value };
                                  return next;
                                });
                              }}
                              className="w-full border-2 border-gray-300 rounded-md px-4 py-3 text-lg font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                              placeholder="Nhập đáp án chính xác..."
                            />
                            {data.answer && (
                              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                <div className="text-xs font-bold text-emerald-700 mb-1">Xem trước đáp án</div>
                                <RichTextDisplay html={toPreviewHtml(data.answer)} />
                              </div>
                            )}
                            {expandedExplanation === id && (
                              <div className="mt-3 space-y-2">
                                <textarea
                                  rows={2}
                                  value={data.explanation || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setEditingDraft((prev) => {
                                      if (!prev) return prev;
                                      const next = JSON.parse(JSON.stringify(prev)) as ExamVersion;
                                      (next.derivedExam.part3 as any)[qNum] = { ...((next.derivedExam.part3 as any)[qNum] || {}), explanation: value };
                                      return next;
                                    });
                                  }}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                                  placeholder="Lời giải chi tiết"
                                />
                                {data.explanation && (
                                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                                    <div className="text-xs font-bold text-blue-700 mb-1">Xem trước công thức</div>
                                    <RichTextDisplay html={toPreviewHtml(data.explanation)} />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

