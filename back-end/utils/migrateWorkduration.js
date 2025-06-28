// // scripts/migrateWorkDuration.js
// require('dotenv').config();
// const { MongoClient, ObjectId } = require('mongodb');

// async function migrate() {
//   const uri = process.env.DATABASE_URI;
//   if (!uri) throw new Error('Missing MONGO_URI');

//   const client = new MongoClient(uri, { useUnifiedTopology: true });
//   await client.connect();
//   const db = client.db();                 // default database
//   const col = db.collection('users');     // hoặc tên khác nếu bạn dùng

//   // Lấy toàn bộ user có trường expectedWorkDuration.min
//   const cursor = col.find({ 'expectedWorkDuration.min': { $exists: true } });
//   while (await cursor.hasNext()) {
//     const u = await cursor.next();
//     const { min, max, unit } = u.expectedWorkDuration;

//     // Bỏ qua nếu thiếu hoặc không phải số
//     if (typeof min !== 'number' || typeof max !== 'number') {
//       console.log('skip user', u._id, 'min/max invalid');
//       continue;
//     }

//     // Xác định số ngày để cộng
//     const factorMap = { days: 1, weeks: 7, months: 30, years: 365 };
//     const factor = factorMap[unit] || 1;
//     const now = new Date();
//     const end = new Date(now);
//     end.setDate(end.getDate() + max * factor);

//     // Cập nhật database: set new startDate/endDate, unset cũ
//     await col.updateOne(
//       { _id: u._id },
//       {
//         $set: {
//           'expectedWorkDuration.startDate': now,
//           'expectedWorkDuration.endDate': end
//         },
//         $unset: {
//           'expectedWorkDuration.min': '',
//           'expectedWorkDuration.max': '',
//           'expectedWorkDuration.unit': ''
//         }
//       }
//     );
//     console.log('migrated user', u._id);
//   }

//   await client.close();
//   console.log('Migration finished');
// }

// migrate().catch(err => {
//   console.error(err);
//   process.exit(1);
// });

// scripts/migrateBoardWorkDuration.js
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function migrate() {
  const uri = process.env.DATABASE_URI;
  if (!uri) {
    console.error('❌ Missing MONGO_URI in .env');
    process.exit(1);
  }

  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db();              // nếu cần, bạn có thể db = client.db('yourDbName');
  const boards = db.collection('boards');

  // Tìm tất cả boards có workDuration.min tồn tại
  const cursor = boards.find({ 'criteria.workDuration.min': { $exists: true } });

  const factorMap = {
    days:   1,
    weeks:  7,
    months: 30,
    years:  365
  };

  let count = 0;
  while (await cursor.hasNext()) {
    const b = await cursor.next();
    const wd = b.criteria?.workDuration || {};
    const { min, max, unit } = wd;

    // Bỏ qua nếu min/max không phải số
    if (typeof min !== 'number' || typeof max !== 'number') {
      console.warn(`-- skip board ${b._id}: invalid min/max`);
      continue;
    }

    const factor = factorMap[unit] || 1;
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + max * factor);

    // Cập nhật document: set startDate/endDate, unset min/max/unit
    await boards.updateOne(
      { _id: b._id },
      {
        $set: {
          'criteria.workDuration.startDate': now,
          'criteria.workDuration.endDate':   end
        },
        $unset: {
          'criteria.workDuration.min':  '',
          'criteria.workDuration.max':  '',
          'criteria.workDuration.unit': ''
        }
      }
    );

    console.log(`✔ Migrated board ${b._id}`);
    count += 1;
  }

  console.log(`\nDone! Migrated ${count} boards.`);
  await client.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

