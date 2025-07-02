// Helper function để tạo Content-Disposition header an toàn
exports.createContentDispositionHeader = (filename) => {
  try {
    // Chỉ giữ lại ký tự ASCII an toàn
    const safeFilename = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Chỉ giữ ký tự, số, dấu chấm, gạch dưới, gạch ngang
      .replace(/_{2,}/g, '_') // Thay thế nhiều _ liên tiếp bằng 1 _
      .replace(/^_+|_+$/g, ''); // Loại bỏ _ ở đầu và cuối

    // Đảm bảo tên file không rỗng
    const finalFilename = safeFilename || 'download';

    return `attachment; filename="${finalFilename}"`;
  } catch (error) {
    console.error('Error creating content disposition header:', error);
    return 'attachment; filename="download"';
  }
};
