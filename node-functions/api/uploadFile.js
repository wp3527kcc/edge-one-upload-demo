import { getUploadList } from '@/app/services/upload';
import { TosClient } from '@volcengine/tos-sdk';
import { pool } from '@/app/utils/db';

const accessKeyId = process.env.TOS_ACCESS_KEY_ID || '';
const accessKeySecret = process.env.TOS_ACCESS_KEY_SECRET || '';
const bucket = process.env.BUCKET_NAME || '';
const region = process.env.TOS_REGION || '';
const endpoint = process.env.TOS_ENDPOINT || '';
const client = new TosClient({ accessKeyId, accessKeySecret, region, endpoint });

// 秒传：通过文件hash判断是否已存在
async function checkFileExists(hash) {
    const [rows] = await pool.query('SELECT * FROM upload_history WHERE filehash = ?', [hash]);
    const result = Array.isArray(rows) ? rows[0] : null;
    return result;
}

// 获取上传列表
export const POST = async () => {
    const fileList = await getUploadList();
    return Response.json(fileList);
};

// 初始化分片上传，返回uploadId和key
export async function PATCH(request) {
    const body = await request.json();
    const { fileName, fileHash } = body;
    // 秒传：已存在直接返回
    const exists = await checkFileExists(fileHash);
    if (exists) {
        return Response.json({
            message: '秒传成功',
            exists: true,
            fileurl: exists?.fileurl,
            filepath: exists?.filepath,
        });
    }
    // 初始化分片上传
    const { data } = await client.createMultipartUpload({
        bucket,
        key: `operation-resource/${fileHash}_${encodeURIComponent(fileName)}`,
    });
    return Response.json({ uploadId: data.UploadId, key: data.Key });
}

// 上传分片
export async function PUT(request) {
    const formData = await request.formData();
    const fileBlob = formData.get('file');
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadResult = await client.uploadPart({
        bucket,
        key: formData.get('objectName'),
        partNumber: +formData.get('partNumber'),
        uploadId: formData.get('UploadId'),
        body: buffer,
    });
    return Response.json(uploadResult);
}

// 合并分片
export async function DELETE(request) {
    const body = await request.json();
    const { uploadId, key, hash: fileHash, parts } = body;
    // 合并分片
    await client.completeMultipartUpload({
        bucket,
        key,
        uploadId,
        parts,
    });
    // 记录数据库
    await pool.query(
        'INSERT INTO upload_history (filepath, fileurl, create_by, filehash) VALUES (?, ?, ?, ?)',
        [key, `${process.env.CDNBASEURL}${key}`, 'admin', fileHash],
    );
    return Response.json({ message: '合并并上传成功', key });
}

// EdgeOne Node Function 入口：按 HTTP method 分发到对应的处理函数
export const onRequestPost = async ({ request }) => POST(request);
export const onRequestPatch = async ({ request }) => PATCH(request);
export const onRequestPut = async ({ request }) => PUT(request);
export const onRequestDelete = async ({ request }) => DELETE(request);

// 对 GET 访问该路径返回 Method Not Allowed
export const onRequestGet = async () =>
    new Response(JSON.stringify({ message: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });