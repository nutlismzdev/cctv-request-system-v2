/** ecosystem.config.js - PM2 for Next.js (Windows/Production) */
module.exports = {
  apps: [
    {
      name: 'cctv-request',
      // โฟลเดอร์โปรเจกต์ (อย่าใส่ backslash ท้าย)
      cwd: 'C:\\E-services\\cctv_reqeust',

      // วิธีที่ 1: เรียก Next CLI โดยตรง (เสถียร)
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4000',

      // --- หรือถ้าคุณอยากใช้ npm script ที่ทดสอบแล้วว่าเวิร์ก ---
      // script: 'npm',
      // args: 'start',

      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',

      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        NEXT_PUBLIC_BASE_URL: 'https://cctvrequest.itac-huahincity.com'
      },

      time: true,
      error_file: 'C:\\E-services\\cctv_reqeust\\logs\\cctv-next-error.log',
      out_file:   'C:\\E-services\\cctv_reqeust\\logs\\cctv-next-out.log',
      merge_logs: true
    }
  ]
}
