import { getUploadList, getFileByKey, deleteFileByKey } from '@/app/services/upload';
import mime from 'mime-types';

// 对应 Next.js 中的 GET：根据 key 返回文件内容
export const GET = async (request) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) {
    return Response.json({ message: 'Key is required' }, { status: 400 });
  }
  const ext = key.split('.').pop() || '';
  const mimeType = mime.lookup(ext);
  const fileContent = await getFileByKey(key);
  return new Response(fileContent, {
    headers: {
      'Content-Type': `${mimeType || 'application/octet-stream'}; charset=utf-8`,
    },
  });
};

// 获取上传列表
export const POST = async () => {
  const fileList = await getUploadList();
  return Response.json(fileList);
};

// 删除文件
export const DELETE = async (request) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) {
    return Response.json({ message: 'Key is required' }, { status: 400 });
  }
  await deleteFileByKey(key);
  return Response.json({
    message: `File with key ${key} deleted successfully`,
    rows: await getUploadList(),
  });
};

// EdgeOne Node Function 入口：按 HTTP method 分发到对应的处理函数
export const onRequestGet = async ({ request }) => GET(request);
export const onRequestPost = async ({ request }) => POST(request);
export const onRequestDelete = async ({ request }) => DELETE(request);