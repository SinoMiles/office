import { getToolById } from '@/lib/toolsData';
import ToolProcessClient from './ToolProcessClient';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const tool = getToolById(id);
  
  if (!tool) {
    return {
      title: '工具未找到 | OfficeGPT'
    }
  }

  return {
    title: `${tool.name} - AI 办公神器 | OfficeGPT`,
    description: tool.description || `使用 OfficeGPT 的 ${tool.name} 极速处理您的文档。`,
    keywords: [tool.name, 'AI办公', '文档处理', 'OfficeGPT'],
    openGraph: {
      title: `${tool.name} - AI 办公神器 | OfficeGPT`,
      description: tool.description || `使用 OfficeGPT 的 ${tool.name} 极速处理您的文档。`,
    }
  }
}

export default function ToolPage() {
  return <ToolProcessClient />;
}
