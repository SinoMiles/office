'use client';

import { useState, useRef, useEffect, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToolById } from '@/lib/toolsData';
import { ArrowRight, UploadCloud, File as FileIcon, X, CheckCircle2, Download, Loader2, Sparkles } from 'lucide-react';
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

  const seoContent = tool.seo || {
    summary: `${tool.name}用于快速完成${tool.desc}，文件处理完成后可以继续交给 Office AI 分析、修改或生成新文档。`,
    useCases: [`需要${tool.desc}时快速处理`, '批量办公文件整理与交付', '处理后继续进行 AI 文档分析'],
    faqs: [['文件安全吗？', '文件仅用于当前处理任务，不会发送到第三方转换网站。'], ['处理后还能继续编辑吗？', '可以下载结果，也可以进入 Office AI 继续处理。']],
    related: [],
  };
  const relatedTools = (seoContent.related || []).map(getToolById).filter(Boolean);

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
      }
      if (tool.option) formData.append(tool.option.name, optionValue);

      const endpoint = tool.type === 'convert' ? '/api/tools/convert' : tool.type === 'document-util' ? '/api/tools/document' : tool.type === 'image-convert' ? '/api/tools/images' : '/api/tools/pdf';
      if (tool.type === 'document-util') formData.append('action', tool.id);
      if (tool.type === 'image-convert') formData.append('action', tool.id);
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
        
        {tool.type === 'ai' ? (
          <div style={{ background: 'white', borderRadius: '24px', padding: '48px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <Sparkles size={38} color="var(--primary)" style={{ marginBottom: '18px' }} />
            <h2 style={{ fontSize: '1.45rem', marginBottom: '12px' }}>使用 Office AI 开始处理</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto 28px' }}>{seoContent.summary}</p>
            <button onClick={() => router.push(`/dashboard?intent=${tool.id}`)} className="btn btn-primary" style={{ padding: '14px 28px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              上传文件并开始 <ArrowRight size={18} />
            </button>
          </div>
        ) : null}

        {/* Step 1: Upload */}
        {tool.type !== 'ai' && !resultUrl ? (
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
                      <input type={tool.option.type || 'text'} autoComplete={tool.option.type === 'password' ? 'new-password' : undefined} value={optionValue} onChange={(event) => setOptionValue(event.target.value)} placeholder={tool.option.placeholder} style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '0.95rem', outline: 'none' }} />
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
        ) : null}

        {/* Step 2: Success Result */}
        {tool.type !== 'ai' && resultUrl ? (
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
        ) : null}

      </div>
      <section style={{ width: '100%', maxWidth: '900px', marginTop: '72px', display: 'grid', gap: '42px' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', marginBottom: '14px' }}>关于{tool.name}</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.85, fontSize: '1rem' }}>{seoContent.summary}</p>
        </div>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '18px' }}>适合这些场景</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            {seoContent.useCases.map((item) => <div key={item} style={{ padding: '18px', borderRadius: '14px', background: 'white', border: '1px solid var(--border)', lineHeight: 1.6 }}>{item}</div>)}
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '18px' }}>常见问题</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {seoContent.faqs.map(([question, answer]) => <details key={question} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px' }}><summary style={{ cursor: 'pointer', fontWeight: 650 }}>{question}</summary><p style={{ color: 'var(--text-muted)', lineHeight: 1.7, margin: '12px 0 0' }}>{answer}</p></details>)}
          </div>
        </div>
        {relatedTools.length > 0 ? <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '18px' }}>相关工具</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>{relatedTools.map((related) => <Link key={related.id} href={`/tools/${related.id}`} style={{ padding: '11px 15px', borderRadius: '10px', background: 'white', border: '1px solid var(--border)', color: 'var(--text-main)', textDecoration: 'none' }}>{related.name}</Link>)}</div>
        </div> : null}
        <div style={{ padding: '30px', borderRadius: '20px', background: 'linear-gradient(135deg, #eef2ff, #ecfdf5)', border: '1px solid rgba(99,102,241,.15)', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '10px' }}>处理完成后，让 Office AI 继续工作</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>总结、翻译、分析数据，或直接生成 Word、Excel 和 PPT。</p>
          <button onClick={() => router.push('/dashboard')} className="btn btn-primary">进入 Office AI</button>
        </div>
      </section>
    </div>
  );
}
