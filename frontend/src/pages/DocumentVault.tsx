import React, { useState, useEffect } from 'react';
import {
  FolderLock,
  Upload,
  FileText,
  Download,
  Trash2,
  Search,
  Eye,
  Plus,
  BookOpen,
} from 'lucide-react';
import { documentsApi, subjectsApi } from '../services/api';
import { VaultDocument, Subject } from '../types';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

export const DocumentVault: React.FC = () => {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Upload Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('study_material');
  const [uploadSubjectId, setUploadSubjectId] = useState<number | undefined>(undefined);

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewSnippet, setPreviewSnippet] = useState('');
  const [previewDocTitle, setPreviewDocTitle] = useState('');

  const { success, error, warning } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [docs, subs] = await Promise.all([
        documentsApi.getAll(categoryFilter === 'all' ? undefined : categoryFilter),
        subjectsApi.getAll(),
      ]);
      setDocuments(docs);
      setSubjects(subs);
    } catch (err) {
      error('Failed to load document vault.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        warning('Selected file exceeds maximum 15MB limit.');
        return;
      }
      setSelectedFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      error('Please select a file to upload.');
      return;
    }
    if (!uploadTitle.trim()) {
      error('Please enter a document title.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadTitle.trim());
    formData.append('category', uploadCategory);
    if (uploadSubjectId) {
      formData.append('subject_id', uploadSubjectId.toString());
    }

    setUploading(true);
    try {
      await documentsApi.upload(formData);
      success('Document securely uploaded and indexed for AI assistance!');
      setUploadModalOpen(false);
      setSelectedFile(null);
      setUploadTitle('');
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to upload document.';
      error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (doc: VaultDocument) => {
    try {
      const details = await documentsApi.getDetails(doc.id);
      setPreviewDocTitle(doc.title);
      setPreviewSnippet(details.extracted_text_snippet || 'No readable text content extracted.');
      setPreviewModalOpen(true);
    } catch (err) {
      error('Failed to load document preview snippet.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this document from your vault?')) return;
    try {
      await documentsApi.delete(id);
      success('Document removed from vault.');
      loadData();
    } catch (err) {
      error('Failed to delete document.');
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.original_filename.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.subject_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <FolderLock className="w-5 h-5 text-brand-600" />
            <span>Smart Academic Document Vault</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Secure notes, question papers, marksheets & assignment repository with automated text extraction
          </p>
        </div>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Academic File</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by title, subject, file..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="notes">Notes</option>
            <option value="assignment">Assignment File</option>
            <option value="question_paper">Question Paper</option>
            <option value="marksheet">Marksheet</option>
            <option value="certificate">Certificate</option>
            <option value="study_material">Study Material</option>
          </select>
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <LoadingSpinner size="md" label="Loading documents..." className="py-12" />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon={FolderLock}
          title="No documents in your vault"
          description="Upload your class notes (PDF or text) to make them instantly searchable and queryable by the AI Assistant."
          actionText="Upload First Document"
          onAction={() => setUploadModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand-50 text-brand-700">
                    {doc.category.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {doc.file_type}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 leading-tight mb-1">
                  {doc.title}
                </h3>
                <p className="text-[11px] text-slate-400 truncate mb-2">
                  {doc.original_filename}
                </p>

                {doc.subject_name && (
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 mb-2">
                    {doc.subject_name}
                  </span>
                )}

                <div className="text-[10px] text-slate-400">
                  {Math.round(doc.file_size / 1024)} KB • Uploaded {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handlePreview(doc)}
                  className="inline-flex items-center space-x-1 text-xs text-brand-600 font-semibold hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Text</span>
                </button>

                <div className="flex items-center space-x-1">
                  <a
                    href={documentsApi.downloadUrl(doc.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Download physical file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload Academic Document"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select File (PDF, TXT, MD, Images up to 15MB) *
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              required
              className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Document Title *
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. Distributed Systems Exam Notes"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="notes">Class Notes</option>
                <option value="assignment">Assignment Solution</option>
                <option value="question_paper">Question Paper</option>
                <option value="marksheet">Marksheet</option>
                <option value="certificate">Certificate</option>
                <option value="study_material">Study Material</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <select
                value={uploadSubjectId || ''}
                onChange={(e) =>
                  setUploadSubjectId(e.target.value ? parseInt(e.target.value) : undefined)
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="">(None / General)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setUploadModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm disabled:opacity-50"
            >
              {uploading ? 'Extracting & Indexing...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Snippet Preview Modal */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title={`Extracted Text Snippet: ${previewDocTitle}`}
        maxWidth="lg"
      >
        <div className="max-h-96 overflow-y-auto bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap">
          {previewSnippet}
        </div>
      </Modal>
    </div>
  );
};
