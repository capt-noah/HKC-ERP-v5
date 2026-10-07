import mysql from 'mysql2/promise';

async function reconcilePartners() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'habtom',
    password: process.env.MYSQL_PASSWORD || 'DMka6&jn0*Wsdfo0',
    database: process.env.MYSQL_DATABASE || 'hkc_trading',
  });

  console.log('Connected to MySQL. Reconciling Partners Registry...');

  // 1. Authoritative Customer Map
  const customerMap = {
    'CUST-1653': {
      name: 'yeabsera solomon woldesilase',
      phone: '0935641503',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH3-VET-LEBU',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-2246': {
      name: 'SELEMUN MEKONEN',
      phone: '0972143113',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH3-VET-LEBU',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-3174': {
      name: 'ADEN ALI ABDULFETAHI',
      phone: '0916936807',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH3-VET-LEBU',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-3911': {
      name: 'SILANTE WAGNEW',
      phone: '0963567660',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH3-VET-LEBU',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-4306': {
      name: 'yebesera solomon weldeselase',
      phone: '0935641503',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH2-VET-ALEM',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-6550': {
      name: 'beweketu kbretu',
      phone: '0913883849',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH2-VET-ALEM',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-6710': {
      name: 'weldabrh hadg gebiru',
      phone: '0910972443',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH3-VET-LEBU',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-6909': {
      name: 'hana gebremedhin',
      phone: '0941103627',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH3-VET-LEBU',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-6924': {
      name: 'GAWA VET MED/TAYIB MAHAMOUD',
      phone: '0915033798',
      tin: '098765234',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH1-AGRI-EXP',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-7998': {
      name: 'DEREBE MEKONNEN',
      phone: '0914783070',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH3-VET-LEBU',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-8518': {
      name: 'DR ABDELA ENDRIS/SUPER FAT VETERINARY',
      phone: '0918012302',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH3-VET-LEBU',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
    'CUST-9600': {
      name: 'LIDETU AYFERUM',
      phone: '0983904174',
      category: 'Pharmaceutical Distributor',
      warehouseTarget: 'WH3-VET-LEBU',
      country: 'Ethiopia',
      region: 'Addis Ababa',
    },
  };

  const [existingCustomers] = await conn.query('SELECT id, payload FROM customers');
  console.log(`Auditing ${existingCustomers.length} existing customer records...`);

  for (const row of existingCustomers) {
    let payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
    const auth = customerMap[row.id];
    if (auth) {
      const merged = {
        ...payload,
        id: row.id,
        name: auth.name,
        phone: auth.phone || payload.phone,
        tin: auth.tin || payload.tin || undefined,
        category: auth.category || payload.category,
        warehouseTarget: auth.warehouseTarget || payload.warehouseTarget,
        country: auth.country || payload.country || 'Ethiopia',
        region: auth.region || payload.region || 'Addis Ababa',
        status: payload.status || 'Active',
      };
      await conn.query('UPDATE customers SET payload = ?, updated_at = NOW(3) WHERE id = ?', [
        JSON.stringify(merged),
        row.id,
      ]);
      console.log(`✅ Reconciled customer: ${row.id} -> ${auth.name} (${auth.phone})`);
    }
  }

  // Check if any customer in customerMap is missing from the table entirely
  const existingIds = new Set(existingCustomers.map((r) => r.id));
  for (const [id, auth] of Object.entries(customerMap)) {
    if (!existingIds.has(id)) {
      const newPayload = {
        id,
        name: auth.name,
        phone: auth.phone,
        tin: auth.tin || undefined,
        category: auth.category,
        warehouseTarget: auth.warehouseTarget,
        country: auth.country,
        region: auth.region,
        status: 'Active',
      };
      await conn.query('INSERT INTO customers (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))', [
        id,
        JSON.stringify(newPayload),
      ]);
      console.log(`➕ Inserted missing customer: ${id} -> ${auth.name}`);
    }
  }

  // 2. Authoritative Suppliers List
  const suppliersList = [
    {
      id: 'SUP-1789991611561',
      name: 'ZEYNU',
      country: 'Ethiopia',
      city: 'Addis Ababa',
      category: 'Agricultural Producer / Union',
      warehouseTarget: 'WH1-AGRI-EXP',
      status: 'Active',
    },
    {
      id: 'SUP-1789991938544',
      name: 'GIRMA',
      country: 'Ethiopia',
      city: 'Addis Ababa',
      category: 'Agricultural Producer / Union',
      warehouseTarget: 'WH1-AGRI-EXP',
      status: 'Active',
    },
    {
      id: 'SUP-1789992315544',
      name: 'HUSSEN',
      country: 'Ethiopia',
      city: 'Addis Ababa',
      category: 'Agricultural Producer / Union',
      warehouseTarget: 'WH1-AGRI-EXP',
      status: 'Active',
    },
    {
      id: 'SUP-1789992720520',
      name: 'SAMUEL',
      country: 'Ethiopia',
      city: 'Addis Ababa',
      category: 'Agricultural Producer / Union',
      warehouseTarget: 'WH1-AGRI-EXP',
      status: 'Active',
    },
  ];

  const [existingSuppliers] = await conn.query('SELECT id, payload FROM suppliers');
  console.log(`Auditing ${existingSuppliers.length} existing supplier records...`);

  for (const supp of suppliersList) {
    const existing = existingSuppliers.find((r) => {
      let p = typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {});
      return r.id === supp.id || (p.name && p.name.toLowerCase().trim() === supp.name.toLowerCase().trim());
    });

    if (existing) {
      let p = typeof existing.payload === 'string' ? JSON.parse(existing.payload) : (existing.payload || {});
      const merged = { ...p, ...supp, id: existing.id };
      await conn.query('UPDATE suppliers SET payload = ?, updated_at = NOW(3) WHERE id = ?', [
        JSON.stringify(merged),
        existing.id,
      ]);
      console.log(`✅ Updated supplier: ${existing.id} -> ${supp.name}`);
    } else {
      await conn.query('INSERT INTO suppliers (id, payload, created_at, updated_at) VALUES (?, ?, NOW(3), NOW(3))', [
        supp.id,
        JSON.stringify(supp),
      ]);
      console.log(`➕ Inserted supplier: ${supp.id} -> ${supp.name}`);
    }
  }

  await conn.end();
  console.log('🎉 Partner Registry reconciliation completed successfully!');
}

reconcilePartners().catch((err) => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});
