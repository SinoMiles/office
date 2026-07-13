'use client';

import { useState, useRef, useEffect, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToolById } from '@/lib/toolsData';
import { ArrowLeft, UploadCloud, File as FileIcon, X, CheckCircle2, Download, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ToolProcessPage() {
  const params = useParams();
  const toolId = params.id;
  const router = useRouter();
  
  // getToolById expects toolId, since tool is constant for the page, we derive it
  const tool = getToolById(toolId);

  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState(null);
  const [resultFilename, setResultFilename] = useState('');
  const [optionValue, setOptionValue] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!tool) {
      router.push('/tools');
    }
  }, [tool, router]);

  if (!tool) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (selectedFiles) => {
    if (!tool.multiple && selectedFiles.length > 1) {
      selectedFiles = [selectedFiles[0]];
    }
    setFiles(selectedFiles);
    setResultUrl(null);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startProcessing = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    const toastId = toast.loading('文件正在安全处理中...');

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append(tool.type === 'convert' ? 'file' : 'files', files[i]);
      }
      
      if (tool.type === 'pdf-util') {
        formData.append('action', tool.id);
        if (tool.option) formData.append(tool.option.name, optionValue);
      }

      const endpoint = tool.type === 'convert' ? '/api/tools/convert' : '/api/tools/pdf';
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errMsg = '处理失败，请重试';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch(e) {}
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      
      const contentDisposition = res.headers.get('content-disposition');
      let filename = 'processed_document.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
        if (filenameMatch && filenameMatch.length > 1) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      setResultUrl(url);
      setResultFilename(filename);
      toast.success('处理成功！', { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      
      {/* Tool Title in Workspace */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px', textAlign: 'center', animation: 'slideUp 0.3s ease-out' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', marginBottom: '16px', border: '1px solid var(--border)' }}>
          {tool.icon}
        </div>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: 800 }}>{tool.name}</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.1rem' }}>{tool.desc}</p>
      </div>

      <div style={{ width: '100%', maxWidth: '800px', animation: 'slideUp 0.4s ease-out' }}>
        
        {/* Step 1: Upload */}
        {!resultUrl && (
          <div style={{ background: 'white', borderRadius: '24px', padding: '40px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
            
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => files.length === 0 && fileInputRef.current?.click()}
                onMouseOver={(e) => {
                  if (files.length === 0) {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.04)';
                  }
                }}
                onMouseOut={(e) => {
                  if (files.length === 0) {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--background)';
                  }
                }}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: '24px',
                  padding: '80px 20px',
                  textAlign: 'center',
                  background: 'var(--background)',
                  cursor: files.length === 0 ? 'pointer' : 'default',
                  transition: 'all 0.3s ease'
                }}
              >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(Array.from(e.target.files));
                }}
                accept={tool.accept}
                multiple={tool.multiple}
              />
              
              {files.length === 0 ? (
                <>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', boxShadow: 'var(--shadow-sm)' }}>
                    <UploadCloud size={40} color="var(--text-muted)" style={{ opacity: 0.8 }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>点击或拖拽上传文件</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>支持 {tool.accept} 格式，全程加密处理</p>
                </>
              ) : (
                <div style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>已准备好 {files.length} 个文件</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                    {files.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <FileIcon size={20} color="var(--text-muted)" />
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.95rem', fontWeight: 500 }}>{f.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                        <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '4px' }}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {tool.option ? (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', fontSize: '0.9rem', fontWeight: 600 }}>
                      {tool.option.label}
                      <input value={optionValue} onChange={(event) => setOptionValue(event.target.value)} placeholder={tool.option.placeholder} style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '0.95rem', outline: 'none' }} />
                    </label>
                  ) : null}
                  
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); startProcessing(); }}
                      disabled={isProcessing || Boolean(tool.option && !optionValue.trim())}
                      className="btn btn-primary"
                      style={{ fontSize: '1.1rem', padding: '16px 48px', width: '100%', maxWidth: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                      {isProcessing ? (
                        <><Loader2 className="spin-anim" size={20} /> 处理中...</>
                      ) : (
                        <><Sparkles size={20} /> 立即开始处理</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Success Result */}
        {resultUrl && (
          <div style={{ background: 'white', borderRadius: '24px', padding: '60px 40px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', textAlign: 'center', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
              <CheckCircle2 size={40} color="#16a34a" />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>处理成功！</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '40px' }}>您的文件 <strong>{resultFilename}</strong> 已经准备就绪。</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <a 
                href={resultUrl} 
                download={resultFilename}
                className="btn btn-primary" 
                style={{ textDecoration: 'none', fontSize: '1.2rem', padding: '18px 48px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)' }}
              >
                <Download size={24} /> 下载处理结果
              </a>
              
              <button 
                onClick={() => {
                  setFiles([]);
                  setResultUrl(null);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, padding: '12px', marginTop: '16px' }}
              >
                处理另一份文件
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
