import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  X,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  FileDown,
  HelpCircle,
  Info,
  ChevronRight,
  Settings,
  Plus,
  AlertCircle,
  Trash2,
  Minimize2,
  Maximize2,
  Layers,
  ArrowRight
} from "lucide-react";

interface StagedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 data URI
  previewUrl?: string; // For images
}

export default function App() {
  // Application State
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [extractedResult, setExtractedResult] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Convert standard digits to Bengali numerals
  const convertToBanglaNumber = (num: number): string => {
    const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
    return Math.round(num)
      .toString()
      .replace(/\d/g, (d) => banglaDigits[parseInt(d)]);
  };

  // Suggested Prompts list
  const promptPresets = [
    {
      label: "শুধু হেডলাইন নাও",
      englishLabel: "Headlines Only",
      prompt: "নথির ভেতরের শুধুমাত্র হেডলাইনগুলো বা মূল উপশিরোনামগুলো আলাদা করে একটি তালিকার আকারে আউটপুট দাও।"
    },
    {
      label: "টেক্সট সামারি করো",
      englishLabel: "Summarize Content",
      prompt: "সম্পূর্ণ নথির মূল বক্তব্য সংক্ষেপে ৫-১০টি পয়েন্টের মাধ্যমে বাংলা এবং ইংরেজিতে সামারি করে দাও।"
    },
    {
      label: "টেবিলগুলো আলাদা করো",
      englishLabel: "Extract Tables",
      prompt: "নথিতে কোনো টেবিল বা তথ্যছক থাকলে সেগুলোকে হুবহু Markdown Table ফরম্যাটে আলাদা করো। অন্যান্য টেক্সট বাদ দাও।"
    },
    {
      label: "কবিতার লাইন আলাদা করো",
      englishLabel: "Extract Poem Lines",
      prompt: "শুধু ইংরেজি লেখাগুলো বাদ দিয়ে মূল বাংলা টেক্সট বা বাংলা কবিতার ছন্দবদ্ধ লাইনগুলো আলাদা করো।"
    },
    {
      label: "ইমেইল ও ফোন নম্বর খোঁজ",
      englishLabel: "Extract Contacts",
      prompt: "সম্পূর্ণ নথিটি পুঙ্খানুপুঙ্খভাবে স্ক্যান করে এর ভেতর থাকা সব ইমেইল (Emails) এবং ফোন নম্বরগুলোর (Phone Numbers) একটি পরিষ্কার সূচি তৈরি করো।"
    }
  ];

  // Simulated loading steps sequence for smooth UI transition
  const loadingSteps = [
    "ফাইল রিডিং সম্পাদন করা হচ্ছে... (Reading files...)",
    "রিমোট সার্ভারে লোড পাঠানো হচ্ছে... (Transferring secure payload to backend...)",
    "জেমিনি ৩.৫ ফ্ল্যাশ ইঞ্জিন সচল হচ্ছে... (Initializing Gemini 3.5 Flash...)",
    "বহুমাত্রিক তথ্য বা লেআউট বিশ্লেষণ ও OCR চলছে... (Running multimodal text analysis...)",
    "বাংলা-ইংরেজি ফন্ট ও লাইনের সংগতি পরীক্ষা করা হচ্ছে... (Refining Bengali & English OCR accuracy...)",
    "কাস্টম প্রম্পটের ডাইনামিক ফিল্টারিং প্রয়োগ হচ্ছে... (Applying custom prompt filters...)"
  ];

  useEffect(() => {
    let stepIndex = 0;
    let stepInterval: NodeJS.Timeout;
    let percentInterval: NodeJS.Timeout;

    if (isProcessing) {
      setProgressPercentage(0);
      setProgressStep(loadingSteps[0]);
      
      stepInterval = setInterval(() => {
        stepIndex = (stepIndex + 1) % loadingSteps.length;
        setProgressStep(loadingSteps[stepIndex]);
      }, 3500);

      percentInterval = setInterval(() => {
        setProgressPercentage((prev) => {
          if (prev >= 98) return prev;
          const remaining = 98 - prev;
          const increment = remaining > 50 
            ? Math.floor(Math.random() * 5) + 3 
            : remaining > 20
            ? Math.floor(Math.random() * 3) + 1
            : remaining > 5
            ? Math.floor(Math.random() * 2) + 0.5
            : 0.1;
          return Math.min(prev + increment, 98);
        });
      }, 150);
    }

    return () => {
      if (stepInterval) clearInterval(stepInterval);
      if (percentInterval) clearInterval(percentInterval);
    };
  }, [isProcessing]);

  // File handling helpers
  const processFilesList = (incomingFiles: FileList | null) => {
    if (!incomingFiles) return;

    setErrorMessage(null);
    Array.from(incomingFiles).forEach((file) => {
      // Limit to 35MB per file to keep base64 memory payloads smooth
      if (file.size > 35 * 1024 * 1024) {
        setErrorMessage(`"${file.name}" ফাইলটি নির্ধারিত সীমা ৩৫ মেগাবাইটের চেয়ে বড়। Please keep file sizes under 35MB.`);
        return;
      }

      // Check MIME type is either pdf or images
      const isValidType =
        file.type === "application/pdf" ||
        file.type === "image/png" ||
        file.type === "image/jpeg" ||
        file.type === "image/jpg";

      if (!isValidType) {
        setErrorMessage(`"${file.name}" ফাইলটির ফরম্যাট অনুপযুক্ত। অনুগ্রহ করে শুধু PDF অথবা JPEG/PNG ছবি আপলোড করুন। Only PDF and images are supported.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;

        setFiles((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64Data,
            previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined
          }
        ]);
      };
      reader.onerror = () => {
        setErrorMessage("ফাইলটি প্রসেস করতে ত্রুটি হয়েছে। Failed to read the file.");
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFilesList(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value && e.target.files) {
      processFilesList(e.target.files);
      e.target.value = ""; // Clear file target to let user select the same file if needed
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target && target.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // Convert bytes to human readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Trigger server-side OCR Extraction
  const handleExtractText = async () => {
    if (files.length === 0) {
      setErrorMessage("অনুগ্রহ করে প্রথমে এক বা একাধিক PDF বা ইমেজ ফাইল আপলোড করুন। Please upload at least one PDF or image file.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setExtractedResult("");

    try {
      // Map files array to simple payload elements
      const payloadFiles = files.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        data: f.data
      }));

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          files: payloadFiles,
          customPrompt: customPrompt.trim()
        })
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", responseText);
        throw new Error(`সার্ভার থেকে প্রাপ্ত তথ্য ত্রুটিপূর্ণ (Expected JSON, but received HTML). Server Status: ${response.status}. Preview: ${responseText.slice(0, 150)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || "OCR extraction failed on server.");
      }

      setProgressPercentage(100);
      setProgressStep("ডকুমেন্ট অ্যানালাইসিস ও এক্সট্রাকশন ১০০% সম্পন্ন হয়েছে! (Extraction Complete!)");
      await new Promise((resolve) => setTimeout(resolve, 600));
      setExtractedResult(data.text);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "সার্ভার থেকে রেসপন্স পেতে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট কানেকশন চেক করে আবার চেষ্টা করুন।");
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy to Clipboard helper
  const handleCopyToClipboard = () => {
    if (!extractedResult) return;
    navigator.clipboard.writeText(extractedResult)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Clipboard copy error:", err);
      });
  };

  // Download raw extracted markdown file
  const handleDownloadFile = () => {
    if (!extractedResult) return;
    const blob = new Blob([extractedResult], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Extracted_Text_${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset current workspace state
  const handleResetWorkspace = () => {
    // Revoke object URLs to avoid memory leaks
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
    setCustomPrompt("");
    setExtractedResult("");
    setErrorMessage(null);
    setIsFullscreen(false);
  };

  // Calculate statistics of the current output
  const stats = {
    characters: extractedResult ? extractedResult.length : 0,
    words: extractedResult ? extractedResult.trim().split(/\s+/).filter(Boolean).length : 0,
    paragraphs: extractedResult ? extractedResult.split(/\n\s*\n/).filter(Boolean).length : 0
  };

  const totalFilesSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans antialiased pb-12">
      {/* Dynamic Navigation/Header Line */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-45 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-xs transition-all duration-300">
                <Layers className="w-5.5 h-5.5" id="app-logo-icon" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2" id="app-main-title">
                  HASIB Bro <span className="text-sm font-normal text-gray-400">|</span> মাল্টিমডাল ডকুমেন্ট টেক্সট এক্সট্রাক্টর
                  <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full hidden md:inline-block">
                    Gemini 3.5 Flash
                  </span>
                </h1>
                <p className="text-xs font-semibold text-blue-600 mt-0.5">
                  হেল্পলাইন: ০১৮৩১৪১০৯৯১ (01831410991)
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Define custom extraction rules and scan Bengali & English document files instantly
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              {files.length > 0 && (
                <button
                  id="reset-workspace-btn"
                  onClick={handleResetWorkspace}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold bg-white hover:bg-gray-50 transition-all cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  নতুন করে শুরু (Reset)
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Box */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Intro Guidelines Banner */}
        <div className="mb-6 rounded-2xl bg-white border border-gray-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">অ্যাপটি কীভাবে কাজ করে? (How It Works)</h2>
              <p className="text-xs text-gray-500 leading-relaxed mt-1">
                ১. নিচের ড্রপজোনে ২০-৩০ মেগাবাইটের যেকোনো বাংলা বা ইংরেজি <strong className="text-blue-600 font-semibold">PDF</strong> অথবা <strong className="text-blue-600 font-semibold">ছবি (JPEG/PNG)</strong> আপলোড করবেন। <br />
                ২. ডিফল্টভাবে সম্পূর্ণ টেক্সট এক্সট্রাক্ট হবে। কিন্তু আপনি চাইলে <strong className="text-blue-600 font-semibold">কাস্টম প্রম্পট</strong> ইঞ্জিনে নির্দিষ্ট নির্দেশনা লিখে যেকোনো তথ্য ফিল্টার, সামারি বা রিফরম্যাট করতে পারেন।
              </p>
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-end gap-1 shrink-0 border-l border-gray-100 pl-6">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tech Specs</span>
            <span className="text-xs text-gray-500 font-mono">Max payload limits: 35MB</span>
            <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md text-[10px]">Multimodal OCR Enabled</span>
          </div>
        </div>

        {/* Workspace Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT SIDEBAR: Controller Panel (File selection and prompt settings) */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Loader & Upload Drag-Drop System */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs relative">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3.5 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                ফাইল সংযোজন করুন (Add Files)
              </h3>

              {/* Drag Area */}
              <div
                id="file-dropzone-area"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all duration-300 min-h-[170px] cursor-pointer ${
                  isDragging
                    ? "border-blue-500 bg-blue-50/40 scale-[0.99]"
                    : "border-gray-200 hover:border-blue-500 bg-gray-50/30 hover:bg-white"
                }`}
              >
                <input
                  type="file"
                  id="app-file-input"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleFileInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />

                <div className="bg-white p-3 rounded-full shadow-xs mb-3 text-blue-600 border border-gray-100">
                  <Plus className="w-5 h-5" />
                </div>

                <p className="text-xs font-semibold text-gray-900 text-center px-4">
                  এখানে সিলেক্ট করুন অথবা ড্র্যাগ করে ফাইল ছেড়ে দিন
                </p>
                <p className="text-[11px] text-gray-400 text-center mt-1.5 px-4 leading-relaxed">
                  PDF ফাইল এবং JPEG, PNG ছবি একসাথে যোগ করা যাবে (সর্বোচ্চ ৩৫ মেগাবাইট)
                </p>

                {/* Drop highlight overlay */}
                <AnimatePresence>
                  {isDragging && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-20 pointer-events-none"
                    >
                      <span className="text-xs font-bold text-blue-800 bg-white px-4 py-2 rounded-full shadow-md flex items-center gap-1.5 animate-bounce">
                        <UploadCloud className="w-4 h-4" /> ড্রপ করার জন্য ফাইলটি ছাড়ুন
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Uploaded Queue List */}
              {files.length > 0 && (
                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      সংযুক্ত ফাইলসমূহ ({files.length})
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
                      মোট সাইজ: {formatFileSize(totalFilesSize)}
                    </span>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    <AnimatePresence initial={false}>
                      {files.map((file) => (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex items-center justify-between p-3 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-xl group transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            {file.type.startsWith("image/") ? (
                              file.previewUrl ? (
                                <img
                                  src={file.previewUrl}
                                  alt="preview"
                                  className="w-8 h-8 rounded-md object-cover border border-blue-200 shrink-0"
                                />
                              ) : (
                                <div className="p-1.5 bg-gray-100 text-gray-500 rounded-lg shrink-0">
                                  <ImageIcon className="w-4 h-4" />
                                </div>
                              )
                            ) : (
                              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="text-sm font-medium text-blue-950 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-[10px] text-blue-600 font-mono mt-0.5 font-semibold">
                                {file.type.split("/")[1]?.toUpperCase() || "FILE"} • {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>

                          <button
                            id={`remove-file-${file.id}`}
                            onClick={() => removeFile(file.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Advanced Custom Prompt Engine Settings Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-blue-600" />
                  কাস্টম প্রম্পট ইঞ্জিন (Advanced Instruction Engine)
                </h3>
                <div className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  <div className="absolute right-0 bottom-full mb-2 w-64 bg-gray-800 text-white text-[10px] leading-relaxed p-2.5 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    এখানে আপনার পছন্দমতো নির্দেশনা লিখুন। যেমন: &ldquo;শুধু হেডলাইনগুলো নাও&rdquo;, &ldquo;টেক্সট সামারি করো&rdquo; ইত্যাদি। এটি পরিবর্তন করলে Gemini সেই নির্দেশনা মেনে আউটপুট ফরম্যাট করবে। খালি রাখলে সাধারণ OCR টেক্সট কপি করতে সহজ স্ক্রিনে চলে আসবে।
                  </div>
                </div>
              </div>

              {/* Suggestions Quick Bar */}
              <div className="mb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  একটি চমৎকার প্রম্পট টেমপ্লেট বেছে নিন (Quick Presets):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {promptPresets.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      id={`preset-prompt-btn-${index}`}
                      onClick={() => setCustomPrompt(preset.prompt)}
                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border ${
                        customPrompt === preset.prompt
                          ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Text Box */}
              <div className="relative">
                <textarea
                  id="custom-setting-prompt-box"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="খালি রাখলে পুরো ফাইলের সব টেক্সট এক্সট্রাক্ট করা হবে। কাস্টম নির্দেশ করতে এখানে লিখুন, যেমন: 'টেবিলগুলো বাদ দিয়ে মূল ইংরেজি রকেট লঞ্চ ডেটা আলাদা করো...'"
                  className="w-full min-h-[110px] max-h-[200px] p-3 text-sm bg-[#F9FAFB] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 leading-relaxed placeholder-gray-400 transition-all custom-scrollbar resize-none"
                />
                {customPrompt && (
                  <button
                    id="clear-custom-prompt-btn"
                    onClick={() => setCustomPrompt("")}
                    className="absolute right-2.5 bottom-2.5 px-2 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-800 rounded-lg transition-all text-[10px] font-bold cursor-pointer"
                  >
                    ভ্যানিশ করুন (Clear)
                  </button>
                )}
              </div>
            </div>

            {/* Render Error Message Banner */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-red-900">ত্রুটি দেখা দিয়েছে (An Error Occurred)</p>
                  <p className="mt-1 leading-relaxed">{errorMessage}</p>
                </div>
              </motion.div>
            )}

            {/* MAIN BUTTON: TRIGGER DEEP ANALYSIS */}
            <button
              id="extract-text-main-trigger"
              disabled={isProcessing || files.length === 0}
              onClick={handleExtractText}
              className={`w-full py-3.5 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-300 transform active:scale-[0.98] cursor-pointer ${
                files.length === 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200"
                  : isProcessing
                  ? "bg-blue-700 text-white cursor-wait"
                  : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isProcessing && "animate-spin"}`} />
              {isProcessing ? "প্রসেস করা হচ্ছে..." : "টেক্সট এক্সট্রাক্ট করুন (Extract Text)"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>

          {/* RIGHT VIEWPORT: Process Results Content Area */}
          <div className={`lg:col-span-7 flex flex-col justify-stretch ${isFullscreen ? "fixed inset-0 z-50 bg-white p-6 md:p-8" : ""}`}>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex-1 flex flex-col min-h-[460px] overflow-hidden">
              
              {/* Header inside the Extracted viewer */}
              <div className="border-b border-gray-200 px-5 py-4 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest" id="extracted-text-header-title">
                    প্রাপ্ত টেক্সট আউটপুট (Extracted Result)
                  </h3>
                </div>

                {/* Operations bar */}
                <div className="flex items-center gap-1.5">
                  {extractedResult && (
                    <>
                      <button
                        id="fullscreen-toggle-btn"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-1 px-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title={isFullscreen ? "ছোট উইন্ডো" : "ফুলস্ক্রিন করুন"}
                      >
                        {isFullscreen ? (
                          <>
                            <Minimize2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">স্বাভাবিক উইন্ডো</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">ফুলস্ক্রিন</span>
                          </>
                        )}
                      </button>

                      <button
                        id="copy-text-clipboard-btn"
                        onClick={handleCopyToClipboard}
                        className="p-1 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>কপি হয়েছে!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>কপি করুন (Copy)</span>
                          </>
                        )}
                      </button>

                      <button
                        id="download-text-file-btn"
                        onClick={handleDownloadFile}
                        className="p-1 px-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="ফাইল ডাউনলোড করুন"
                      >
                        <FileDown className="w-3.5 h-3.5 text-gray-500" />
                        <span className="hidden sm:inline">ডাউনলোড</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Dynamic display panels */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-stretch bg-white">
                
                {/* 1. INITIAL EMPTY STATE */}
                {!isProcessing && !extractedResult && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 bg-slate-50 text-[#cbd5e1] border border-dashed border-gray-200 rounded-full flex items-center justify-center mb-4">
                      <FileText className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">
                      কোনো টেক্সট এখনো নিষ্কাশন করা হয়নি
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5 max-w-sm leading-relaxed">
                      বামে ফাইল আপলোড করে নিচের এক্সট্রাক্ট বোতামে ক্লিক করুন। হাই-পারফরম্যান্স জেমিনি এআই দিয়ে আপনার ফাইলটির বাংলা ও ইংরেজি লেখা হুবহু এক্সট্রাক্ট করে দেওয়া হবে।
                    </p>

                    <div className="mt-8 border-t border-gray-100 pt-6 w-full max-w-md">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center mb-3">
                        নির্দেশনার উদাহরন (Pro-tip presets):
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                        <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-200 text-[11px] text-gray-600 leading-relaxed">
                          <span className="font-semibold text-blue-600 block mb-0.5">• শুধু ইংরেজি বাদ দিন</span>
                          &ldquo;সম্পূর্ণ ফাইলটি থেকে শুধু ইংরেজি টেক্সটগুলো ফেলে দাও এবং বাংলা কবিতায় রূপান্তর করো।&rdquo;
                        </div>
                        <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-200 text-[11px] text-gray-600 leading-relaxed">
                          <span className="font-semibold text-blue-600 block mb-0.5">• টেবিলগুলো ফিল্টার</span>
                          &ldquo;নথিতে যেখানে যেখানে টেবিল দেখবে সেগুলোকে Markdown ছকের মতো আলাদা করে সাজাও।&rdquo;
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. LOADING STATE WITH STEPS */}
                {isProcessing && (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    
                    {/* Animated scanning lines simulating ocr scanning */}
                    <div className="relative w-28 h-32 bg-[#F9FAFB] border border-gray-200 shadow-xs rounded-xl overflow-hidden flex items-center justify-center mb-6">
                      <div className="absolute inset-x-0 h-0.5 bg-blue-500 shadow-md shadow-blue-500/50 animate-[bounce_3s_infinite]" />
                      <div className="space-y-1.5 opacity-20 px-4 w-full">
                        <div className="h-2 bg-gray-400 rounded-sm w-3/4" />
                        <div className="h-2 bg-gray-400 rounded-sm w-full" />
                        <div className="h-2 bg-gray-400 rounded-sm w-5/6" />
                        <div className="h-2 bg-gray-400 rounded-sm w-2/3" />
                        <div className="h-2 bg-gray-400 rounded-sm w-4/5" />
                        <div className="h-2 bg-gray-400 rounded-sm w-full" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                      <span className="text-xs font-semibold text-gray-900">ডকুমেন্ট অ্যানালাইসিস সচল রয়েছে (Processing File)...</span>
                    </div>

                    {/* Pro-grade Progress Bar Container: ০-১০০% */}
                    <div className="w-full max-w-sm mt-5 mb-1 px-2">
                      <div className="flex justify-between items-center mb-1.5 text-xs">
                        <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">অগ্রগতি (Progress)</span>
                        <span className="font-semibold text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded-md text-[11px] border border-blue-100 flex items-center gap-1">
                          {convertToBanglaNumber(progressPercentage)}% ({Math.round(progressPercentage)}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                        <motion.div
                          className="h-full bg-blue-600 rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: `${progressPercentage}%` }}
                          transition={{ ease: "linear", duration: 0.1 }}
                        />
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-4 py-2.5 rounded-xl mt-3 max-w-sm">
                      {progressStep}
                    </p>

                    <p className="text-[11px] text-gray-400 mt-2.5 max-w-xs leading-relaxed">
                      বড় PDF ফাইলগুলোর ক্ষেত্রে জেমিনি ইঞ্জিনের সমস্ত পৃষ্ঠা স্ক্যান এবং ফিল্টারিং করতে কিছুক্ষণ সময় লাগতে পারে। অনুগ্রহ করে স্কিন বন্ধ করবেন না।
                    </p>
                  </div>
                )}

                {/* 3. RESULT VIEW STATE */}
                {!isProcessing && extractedResult && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex-1 p-2 focus:outline-none min-h-[300px]">
                      <div className="markdown-body text-gray-800">
                        <Markdown>{extractedResult}</Markdown>
                      </div>
                    </div>

                    {/* Metadata summary count footer */}
                    <div className="border-t border-gray-100 pt-4 mt-6 flex flex-wrap items-center justify-between text-[11px] text-gray-500 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-100 px-2.5 py-1 rounded-md text-gray-700">
                          অক্ষর (Chars): <strong className="text-gray-900 font-mono">{stats.characters}</strong>
                        </span>
                        <span className="bg-gray-100 px-2.5 py-1 rounded-md text-gray-700">
                          শব্দ (Words): <strong className="text-gray-900 font-mono">{stats.words}</strong>
                        </span>
                        <span className="bg-gray-100 px-2.5 py-1 rounded-md text-gray-700">
                          অনুচ্ছেদ (Paragraphs): <strong className="text-gray-900 font-mono">{stats.paragraphs}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-bold border border-blue-100 uppercase tracking-wide">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        কপি করার উপযোগী ফরম্যাট (Copy Friendly)
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </main>

      {/* App Floating Help Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 text-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} HASIB Bro - Multimodal Document OCR & Extractor. Powered by Gemini-3.5-Flash on Cloud Run Container Ingress.
        </p>
        <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
          Strict security boundaries: Key parameters remain on the server.
        </p>
      </footer>
    </div>
  );
}
