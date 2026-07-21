"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getVideo, Video } from "@/src/lib/api";

export default function VideoDetailPage() {
  const params = useParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        if (params.id) {
          const data = await getVideo(params.id as string);
          setVideo(data);
        }
      } catch (error) {
        console.error("Failed to fetch video:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideo();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="text-gray-500">Loading video details...</div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Video not found</h2>
        <Link href="/" className="text-blue-600 hover:underline">Return to Catalog</Link>
      </div>
    );
  }

  // AI Processing status helpers
  const aiStatus = (video as any).ai_processing?.status || "pending";
  const statusColors: Record<string, string> = {
    pending: "text-gray-600 bg-gray-100 border-gray-200",
    processing: "text-blue-700 bg-blue-50 border-blue-200",
    completed: "text-emerald-700 bg-emerald-50 border-emerald-200",
    failed: "text-red-700 bg-red-50 border-red-200",
  };
  const currentBadgeStyle = statusColors[aiStatus] || statusColors.pending;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
      {/* --- NAVIGATION (HEADER) --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              UniMe <span className="text-gray-400 font-normal">Catalog</span>
            </h1>
            <span className="text-xs font-semibold text-slate-500 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
              Details
            </span>
          </div>
          <Link 
            href="/" 
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            ← Back
          </Link>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Video Info */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">
              {video.title}
            </h2>
            
            <div className="space-y-4">
              <div>
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1">Authors</span>
                <p className="text-sm text-slate-800">{video.authors.join(", ")}</p>
              </div>

              {video.tags && video.tags.length > 0 && (
                <div>
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1.5">Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {video.tags.map((tag, idx) => (
                      <span key={idx} className="bg-gray-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                <a 
                  href={video.azure_stream_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z"/></svg>
                  Watch on Stream
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: AI Processing (Transcript & Summary) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col h-full">
            
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-slate-900">AI Analysis</h3>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border capitalize ${currentBadgeStyle}`}>
                {aiStatus}
              </span>
            </div>

            {aiStatus === "pending" || aiStatus === "processing" ? (
              
              /* EMPTY STATE */
              <div className="flex-grow flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 mb-4 text-gray-300">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                  </svg>
                </div>
                <p className="text-sm text-gray-500 max-w-md">
                  {aiStatus === "pending" 
                    ? "AI transcription and summarization are pending. The processing pipeline has not started yet."
                    : "The AI is currently analyzing this video. Transcript and summary will appear here shortly."}
                </p>
              </div>

            ) : (

              /* CONTENT STATE (Completed) */
              <div className="flex flex-col gap-8">
                {/* Summary Slot */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Summary</h4>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4 border border-gray-100 leading-relaxed">
                    {(video as any).ai_processing?.llm_summary || "No summary available."}
                  </div>
                </div>

                {/* Transcript Slot */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Transcript</h4>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4 border border-gray-100 h-64 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                    {(video as any).ai_processing?.whisper_transcript || "No transcript available."}
                  </div>
                </div>
              </div>

            )}
          </section>
        </div>

      </main>
    </div>
  );
}