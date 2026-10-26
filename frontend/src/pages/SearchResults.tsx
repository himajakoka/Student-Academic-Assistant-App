import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  CheckSquare,
  CalendarDays,
  BookOpen,
  Award,
  FolderLock,
  ArrowRight,
} from 'lucide-react';
import { searchApi } from '../services/api';
import { GlobalSearchResponse, SearchResultItem } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

export const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  useEffect(() => {
    if (query) {
      const doSearch = async () => {
        setLoading(true);
        try {
          const res = await searchApi.search(query);
          setResults(res.results);
        } catch (err) {
          error('Search query failed.');
        } finally {
          setLoading(false);
        }
      };
      doSearch();
    }
  }, [query]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'task':
        return <CheckSquare className="w-4 h-4 text-brand-600" />;
      case 'timetable':
        return <CalendarDays className="w-4 h-4 text-indigo-600" />;
      case 'subject':
        return <BookOpen className="w-4 h-4 text-cyan-600" />;
      case 'assessment':
        return <Award className="w-4 h-4 text-emerald-600" />;
      case 'document':
        return <FolderLock className="w-4 h-4 text-violet-600" />;
      default:
        return <Search className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
          <Search className="w-5 h-5 text-brand-600" />
          <span>Global Search Results</span>
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Showing results for <span className="font-bold text-slate-800">"{query}"</span>
        </p>
      </div>

      {loading ? (
        <LoadingSpinner size="md" label="Searching across your academic data..." className="py-12" />
      ) : results.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No records found"
          description={`No tasks, timetable entries, assessments, or documents matched "${query}".`}
        />
      ) : (
        <div className="space-y-2.5">
          {results.map((item, idx) => (
            <Link
              key={idx}
              to={item.link_url}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-brand-300 hover:shadow-md transition-all flex items-center justify-between group block"
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-brand-50 transition-colors shrink-0">
                  {getCategoryIcon(item.category)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 mb-0.5">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {item.title}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{item.subtitle}</p>
                  {item.details && (
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {item.details}
                    </span>
                  )}
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-1 transition-all shrink-0 ml-4" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
