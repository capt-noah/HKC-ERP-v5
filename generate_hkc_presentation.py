import os
import sys
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = pptx.Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette Definitions
    DARK_BG = RGBColor(11, 15, 25)       # #0B0F19 - Deep Midnight Navy
    CARD_BG = RGBColor(20, 27, 45)       # #141B2D - Dark Slate Card
    CARD_BG_ALT = RGBColor(28, 38, 62)   # #1C263E - Slightly lighter card
    CARD_BORDER = RGBColor(38, 52, 84)   # #263454 - Subtle border
    CARD_BORDER_ACTIVE = RGBColor(56, 189, 248) # Sky blue highlight

    ACCENT_GREEN = RGBColor(16, 185, 129)  # #10B981 - Emerald (Agri / WH1)
    ACCENT_CYAN = RGBColor(14, 165, 233)   # #0EA5E9 - Sky Blue (Tech)
    ACCENT_AMBER = RGBColor(245, 158, 11)  # #F59E0B - Gold (Finance)
    ACCENT_PURPLE = RGBColor(168, 85, 247) # #A855F7 - Purple (Pharma / WH2)
    ACCENT_RED = RGBColor(239, 68, 68)     # #EF4444 - Crimson (Alerts)

    TEXT_WHITE = RGBColor(255, 255, 255)
    TEXT_LIGHT = RGBColor(226, 232, 240)  # #E2E8F0
    TEXT_MUTED = RGBColor(148, 163, 184)  # #94A3B8
    TEXT_DIM = RGBColor(100, 116, 139)    # #64748B

    LOGO_PATH = "/Users/Noah/Documents/React/HKC-ERP-v5/public/hkc_logo.png"
    FAVICON_PATH = "/Users/Noah/Documents/React/HKC-ERP-v5/public/hkc_favicon.png"

    def add_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = DARK_BG
        bg.line.fill.background()
        return bg

    def add_header(slide, tag_text, title_text, subtitle_text="", tag_color=ACCENT_CYAN):
        # Category Tag Pill
        tag_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.45), Inches(3.2), Inches(0.38))
        tag_box.fill.solid()
        tag_box.fill.fore_color.rgb = RGBColor(18, 30, 52)
        tag_box.line.color.rgb = tag_color
        tag_box.line.width = Pt(1)
        tf = tag_box.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.text = tag_text.upper()
        p.alignment = PP_ALIGN.CENTER
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = tag_color
        p.font.name = "Arial"

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(10.0), Inches(0.7))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_WHITE
        p_title.font.name = "Arial"

        # Subtitle
        if subtitle_text:
            sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(10.5), Inches(0.45))
            tf_sub = sub_box.text_frame
            tf_sub.word_wrap = True
            p_sub = tf_sub.paragraphs[0]
            p_sub.text = subtitle_text
            p_sub.font.size = Pt(12)
            p_sub.font.color.rgb = TEXT_MUTED
            p_sub.font.name = "Arial"

        # Mini Logo top right
        if os.path.exists(LOGO_PATH):
            try:
                slide.shapes.add_picture(LOGO_PATH, Inches(11.2), Inches(0.45), width=Inches(1.4))
            except Exception as e:
                pass

        # Footer
        footer_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.05), Inches(11.733), Inches(0.35))
        tf_foot = footer_box.text_frame
        p_foot = tf_foot.paragraphs[0]
        p_foot.text = "HKC ERP v5 • Strategic Enterprise Deck • Powered by Next-Gen React 19 Architecture"
        p_foot.font.size = Pt(9.5)
        p_foot.font.color.rgb = TEXT_DIM
        p_foot.font.name = "Arial"

    def add_card(slide, left, top, width, height, title, subtitle="", border_color=CARD_BORDER, bg_color=CARD_BG):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1.2)
        
        # Text box inside card
        tb = slide.shapes.add_textbox(Inches(left + 0.25), Inches(top + 0.2), Inches(width - 0.5), Inches(height - 0.4))
        tf = tb.text_frame
        tf.word_wrap = True
        
        if title:
            p0 = tf.paragraphs[0]
            p0.text = title
            p0.font.size = Pt(15)
            p0.font.bold = True
            p0.font.color.rgb = TEXT_WHITE
            p0.font.name = "Arial"
            
            if subtitle:
                p_sub = tf.add_paragraph()
                p_sub.text = subtitle
                p_sub.font.size = Pt(10.5)
                p_sub.font.color.rgb = TEXT_MUTED
                p_sub.font.name = "Arial"
                p_sub.space_after = Pt(8)
        
        return tf

    # ==========================================
    # SLIDE 1: TITLE SLIDE (CATCHY & HIGH IMPACT)
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)
    add_bg(s1)

    # Ambient glow effect card in background
    glow = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(0.8), Inches(11.733), Inches(5.9))
    glow.fill.solid()
    glow.fill.fore_color.rgb = RGBColor(16, 23, 40)
    glow.line.color.rgb = RGBColor(30, 45, 75)
    glow.line.width = Pt(1.5)

    # Logo Center/Top
    if os.path.exists(LOGO_PATH):
        try:
            s1.shapes.add_picture(LOGO_PATH, Inches(1.3), Inches(1.3), width=Inches(2.6))
        except Exception:
            pass

    # Category Pill
    tag_box = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.3), Inches(2.6), Inches(4.0), Inches(0.42))
    tag_box.fill.solid()
    tag_box.fill.fore_color.rgb = RGBColor(20, 38, 48)
    tag_box.line.color.rgb = ACCENT_CYAN
    tag_box.line.width = Pt(1)
    tf = tag_box.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.text = "NEXT-GENERATION ENTERPRISE PLATFORM"
    p.font.size = Pt(10.5)
    p.font.bold = True
    p.font.color.rgb = ACCENT_CYAN
    p.font.name = "Arial"
    p.alignment = PP_ALIGN.CENTER

    # Main Hero Title
    title_box = s1.shapes.add_textbox(Inches(1.3), Inches(3.1), Inches(10.5), Inches(1.8))
    tf_title = title_box.text_frame
    tf_title.word_wrap = True
    p_title = tf_title.paragraphs[0]
    p_title.text = "HKC ERP v5"
    p_title.font.size = Pt(46)
    p_title.font.bold = True
    p_title.font.color.rgb = TEXT_WHITE
    p_title.font.name = "Arial"

    p_sub1 = tf_title.add_paragraph()
    p_sub1.text = "The Intelligent Operating System for African Commodity Export & Healthcare Logistics"
    p_sub1.font.size = Pt(18)
    p_sub1.font.bold = True
    p_sub1.font.color.rgb = ACCENT_GREEN
    p_sub1.font.name = "Arial"
    p_sub1.space_before = Pt(8)

    p_sub2 = tf_title.add_paragraph()
    p_sub2.text = "Unifying Ethiopian Agricultural Toll Processing, Pharmaceutical FEFO Traceability & Statutory Peachtree Accounting"
    p_sub2.font.size = Pt(13)
    p_sub2.font.color.rgb = TEXT_LIGHT
    p_sub2.font.name = "Arial"
    p_sub2.space_before = Pt(6)

    # 3 Stat / Capability Badges at bottom
    badges = [
        ("WH1 EXPORT HUB", "Modjo Terminal • Coffee, Sesame & Pulses", ACCENT_GREEN),
        ("WH2 & WH3 PHARMA HUBS", "Alem Bank & Lebu • Strict FEFO & Batch Trace", ACCENT_PURPLE),
        ("STATUTORY FINANCE", "Peachtree Sync • VAT 15% • WHT • CBE Banking", ACCENT_AMBER)
    ]
    for i, (b_title, b_sub, b_col) in enumerate(badges):
        b_x = 1.3 + (i * 3.6)
        b_shape = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(b_x), Inches(5.15), Inches(3.4), Inches(1.2))
        b_shape.fill.solid()
        b_shape.fill.fore_color.rgb = RGBColor(12, 18, 32)
        b_shape.line.color.rgb = b_col
        b_shape.line.width = Pt(1.2)
        
        b_tf = b_shape.text_frame
        b_tf.word_wrap = True
        bp1 = b_tf.paragraphs[0]
        bp1.text = b_title
        bp1.font.size = Pt(11)
        bp1.font.bold = True
        bp1.font.color.rgb = b_col
        bp1.font.name = "Arial"
        
        bp2 = b_tf.add_paragraph()
        bp2.text = b_sub
        bp2.font.size = Pt(10)
        bp2.font.color.rgb = TEXT_LIGHT
        bp2.font.name = "Arial"
        bp2.space_before = Pt(4)

    # ==========================================
    # SLIDE 2: THE PROBLEM (WHY GENERIC ERPS BREAK)
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    add_bg(s2)
    add_header(s2, "Industry Challenge", "The Dual-Frontier Dilemma: Why Off-the-Shelf ERPs Fail in Ethiopia", "Cross-border trading companies operate in two incompatible worlds: Commodity Export and Pharmaceutical Import.")

    cards_s2 = [
        ("The Agricultural Export Bottleneck", "WH1 Modjo Operations", [
            "• ECX (Ethiopian Commodity Exchange) lot grading, moisture variance & shrinkage loss.",
            "• Multi-step toll processing: cleaning, destoning, sorting, gravity separation & hulling.",
            "• Rigid export licensing, phytosanitary clearance & customs foreign exchange permits.",
            "• Off-the-shelf ERPs treat grain like retail barcode items, leading to severe stock bleed."
        ], ACCENT_GREEN),
        ("The Healthcare & Veterinary Peril", "WH2 & WH3 Distribution", [
            "• Strict batch-level expiry control; standard FIFO causes catastrophic expired-stock write-offs.",
            "• Cold-chain & regulatory quarantine requirements from Ethiopian FDA and Ministry of Health.",
            "• Multi-currency import landed-costing with customs duty, freight & port clearing overheads.",
            "• Inability to immediately freeze suspect lots without halting full warehouse dispatches."
        ], ACCENT_PURPLE),
        ("The Accounting & Statutory Disconnect", "Peachtree & Tax Reality", [
            "• Most Ethiopian corporate finance teams run on Peachtree (Sage 50); modern cloud ERPs don't integrate.",
            "• Ethiopian tax mandates require automated 15% VAT, 2% goods WHT & 30% unreceipted WHT calculation.",
            "• Traditional software can't do split COA accounting on a single sales issue or receiving voucher.",
            "• Heavy manual reconciliation between CBE / Awash bank accounts and operational cashflows."
        ], ACCENT_AMBER)
    ]

    for i, (c_title, c_sub, bullets, col) in enumerate(cards_s2):
        x = 0.8 + (i * 4.0)
        tf = add_card(s2, x, 2.05, 3.75, 4.8, c_title, c_sub, border_color=col)
        for b in bullets:
            p = tf.add_paragraph()
            p.text = b
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_LIGHT
            p.font.name = "Arial"
            p.space_after = Pt(7)

    # ==========================================
    # SLIDE 3: STRATEGIC TRI-HUB TOPOLOGY
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    add_bg(s3)
    add_header(s3, "Architecture Blueprint", "The Tri-Hub Operating Model: 3 Specialized Gateways, One Core", "Unified command spanning the primary export corridor and the two national pharmaceutical distribution hubs.")

    hubs = [
        ("WH1: Modjo Export Hub", "Agricultural Commodity Terminal", [
            ("Location", "Modjo Dry Port Rail Corridor, Ethiopia"),
            ("Specialization", "Coffee (Yirgacheffe, Sidama), Sesame, Pulses, Soybeans"),
            ("Target Markets", "Europe, Asia, North America, Middle East"),
            ("Core Engines", "Intake Moisture Labs, Destoning, Hulling, Toll Processing Ledger, Model 19 Receiving, Bin Cards"),
            ("Status", "Fully Active • High-Throughput Rail Connected")
        ], ACCENT_GREEN),
        ("WH2: Alem Bank Central Hub", "Veterinary Import & Biologicals", [
            ("Location", "Alem Bank Commercial Hub, Addis Ababa"),
            ("Specialization", "High-Potency Veterinary Drugs, Vaccines, Antibiotics (India)"),
            ("Target Markets", "National Commercial Farms, Regional Vet Clinics, Cooperatives"),
            ("Core Engines", "FEFO Automated Dispatch, Cold-Chain Quarantine, Batch Expiry Radar (<30, <60, <90 days)"),
            ("Status", "Fully Active • Climate & Batch Controlled")
        ], ACCENT_PURPLE),
        ("WH3: Lebu Regional Hub", "Veterinary Supplies & Consumables", [
            ("Location", "Lebu Industrial Center, Addis Ababa"),
            ("Specialization", "Surgical Tools, Syringes, Feed Supplements, Disinfectants (China)"),
            ("Target Markets", "Oromia, Southern Nations, Sidama Regional Distributors"),
            ("Core Engines", "High-Velocity Picking, Carton/Unit Level Matrix, Inter-Warehouse Transfers, Credit Sales Tracking"),
            ("Status", "Fully Active • Regional Fast-Fulfillment Hub")
        ], ACCENT_CYAN)
    ]

    for i, (h_name, h_sub, h_specs, h_col) in enumerate(hubs):
        x = 0.8 + (i * 4.0)
        tf = add_card(s3, x, 2.05, 3.75, 4.8, h_name, h_sub, border_color=h_col)
        for label, val in h_specs:
            p_lbl = tf.add_paragraph()
            p_lbl.text = f"{label.upper()}:"
            p_lbl.font.size = Pt(9.5)
            p_lbl.font.bold = True
            p_lbl.font.color.rgb = h_col
            p_lbl.font.name = "Arial"
            p_lbl.space_before = Pt(4)

            p_val = tf.add_paragraph()
            p_val.text = val
            p_val.font.size = Pt(11)
            p_val.font.color.rgb = TEXT_LIGHT
            p_val.font.name = "Arial"
            p_val.space_after = Pt(4)

    # ==========================================
    # SLIDE 4: WH1 AGRICULTURAL EXPORT ENGINE
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    add_bg(s4)
    add_header(s4, "WH1 Agricultural Engine", "From ECX Intake to Djibouti Port: Zero Discrepancy", "Advanced toll processing, cleaning, destoning, and quality scorecards tailored for Ethiopian export commodities.")

    # Left Card: The Toll Processing Flow (2/3 width)
    tf_flow = add_card(s4, 0.8, 2.05, 7.6, 4.8, "The End-to-End Processing & Shrinkage Pipeline", "Precision yield calculation ensuring full recovery of raw vs clean commodity volumes", border_color=ACCENT_GREEN)
    
    flow_steps = [
        ("1. Raw Commodity Ingestion & Lab Tally", "Direct ECX trucks arrive at Modjo. Automated intake recording initial weight, moisture content, defect percentage, and supplier lot ID."),
        ("2. Multi-Stage Cleaning, Destoning & Hulling", "Mechanical processing across gravity tables, destoners, and optical sorters. System isolates impurities, reject beans, and clean export grade."),
        ("3. Dynamic Shrinkage & Yield Analytics", "Automated calculation of processing shrinkage. Real-time reconciliation comparing intake weight vs net bagged export volume."),
        ("4. Automated Toll Service Fee Engine", "Instant processing fee computation based on tiered rates (USD/ETB per quintal). Invoices and accounts receivable generated automatically."),
        ("5. Official Model 19 Receiving & Bin Card Ledger", "One-click generation of statutory Model 19 vouchers and electronic Bin Cards compliant with Ethiopian customs audits.")
    ]
    for s_title, s_desc in flow_steps:
        p_st = tf_flow.add_paragraph()
        p_st.text = s_title
        p_st.font.size = Pt(11.5)
        p_st.font.bold = True
        p_st.font.color.rgb = ACCENT_GREEN
        p_st.font.name = "Arial"
        p_st.space_before = Pt(4)

        p_sd = tf_flow.add_paragraph()
        p_sd.text = s_desc
        p_sd.font.size = Pt(10.5)
        p_sd.font.color.rgb = TEXT_LIGHT
        p_sd.font.name = "Arial"
        p_sd.space_after = Pt(5)

    # Right Column: 2 Stat/Highlight Cards
    tf_stat1 = add_card(s4, 8.6, 2.05, 3.9, 2.3, "Supplier Quality Scorecards", "Live Performance Rating", border_color=CARD_BORDER_ACTIVE)
    sq_points = [
        "• Tracks purity, moisture & yield by supplier.",
        "• Identifies high-yield cooperatives automatically.",
        "• Enforces deduction penalties on substandard raw grain."
    ]
    for pt in sq_points:
        p = tf_stat1.add_paragraph()
        p.text = pt
        p.font.size = Pt(10.5)
        p.font.color.rgb = TEXT_LIGHT
        p.font.name = "Arial"

    tf_stat2 = add_card(s4, 8.6, 4.55, 3.9, 2.3, "Export Certification Vault", "Regulatory Compliance", border_color=ACCENT_AMBER)
    ec_points = [
        "• Embedded Phytosanitary Certificate tracking.",
        "• Certificate of Origin & ECX inspection linkages.",
        "• Instant export lot traceability for international buyers in Europe & US."
    ]
    for pt in ec_points:
        p = tf_stat2.add_paragraph()
        p.text = pt
        p.font.size = Pt(10.5)
        p.font.color.rgb = TEXT_LIGHT
        p.font.name = "Arial"

    # ==========================================
    # SLIDE 5: WH2 & WH3 PHARMA ENGINE (FEFO)
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    add_bg(s5)
    add_header(s5, "Healthcare & Veterinary Precision", "WH2 & WH3 Pharma Governance: Zero Expired Stock", "Strict First-Expired, First-Out (FEFO) dispatch algorithms, multi-stage expiry radar, and quarantine lockouts.")

    cards_s5 = [
        ("Strict FEFO Enforcement", "Automated Dispatch Priority", [
            "• System strictly forbids older expiry batches from remaining on shelves while newer ones ship.",
            "• Sales order reservation engine automatically pulls the earliest valid expiry lot.",
            "• Eradicates manual picker errors and eliminates tens of thousands in expired product write-downs."
        ], ACCENT_PURPLE),
        ("Triple-Tier Expiry Radar", "Proactive Alerting Windows", [
            "• Level 1 (< 90 Days): Warning notification to sales managers to activate discount promotions.",
            "• Level 2 (< 60 Days): Automatic restriction to short-lead domestic distribution only.",
            "• Level 3 (< 30 Days): Critical alert; dispatches blocked without executive approval stamp."
        ], ACCENT_AMBER),
        ("One-Click Quarantine Matrix", "Immediate Regulatory Isolation", [
            "• Instant quarantine hold on any batch flagged by EFDA or internal lab QA.",
            "• Quarantined stock is immediately excluded from available-to-promise inventory across all channels.",
            "• Complete audit trail recording who initiated quarantine, reasons, and temperature logs."
        ], ACCENT_RED)
    ]

    for i, (c_title, c_sub, bullets, col) in enumerate(cards_s5):
        x = 0.8 + (i * 4.0)
        tf = add_card(s5, x, 2.05, 3.75, 4.8, c_title, c_sub, border_color=col)
        for b in bullets:
            p = tf.add_paragraph()
            p.text = b
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_LIGHT
            p.font.name = "Arial"
            p.space_after = Pt(8)

    # ==========================================
    # SLIDE 6: FINANCE & PEACHTREE INTEGRATION
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    add_bg(s6)
    add_header(s6, "Dual-Engine Accounting", "Peachtree (Sage 50) Harmony & Ethiopian Tax Automation", "Seamlessly unites modern real-time operational ERP with traditional Ethiopian statutory accounting systems.")

    finance_cards = [
        ("Native Peachtree Integration", "Zero Double-Entry", [
            "• 1-Click Bi-Directional Peachtree CSV / Excel Sync.",
            "• Import beginning balances & partner ledger accounts.",
            "• Export sales journals, purchase journals, and general ledger batches directly formatted for Sage 50.",
            "• Closes the gap between warehouse floor operations and finance office ledgers."
        ], ACCENT_AMBER),
        ("Dynamic COA Split Engine", "Granular Cost Allocation", [
            "• Split general ledger accounts across single sales issues, purchase orders, or invoice line items.",
            "• Allocate freight, port clearance, customs duties, and handling directly to appropriate inventory asset accounts.",
            "• Instant COGS (Cost of Goods Sold) recognition as items are dispatched from WH1, WH2, or WH3."
        ], ACCENT_CYAN),
        ("Ethiopian Tax & Bank Engine", "Statutory Compliance", [
            "• Automated 15% VAT computation with compliant invoice numbering.",
            "• 2% Withholding Tax on domestic goods & 30% on unreceipted services.",
            "• Native bank reconciliation templates for Commercial Bank of Ethiopia (CBE), Awash, Dashen & Abyssinia.",
            "• Audit-ready tax export for ERCA / Ministry of Revenue."
        ], ACCENT_GREEN)
    ]

    for i, (c_title, c_sub, bullets, col) in enumerate(finance_cards):
        x = 0.8 + (i * 4.0)
        tf = add_card(s6, x, 2.05, 3.75, 4.8, c_title, c_sub, border_color=col)
        for b in bullets:
            p = tf.add_paragraph()
            p.text = b
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_LIGHT
            p.font.name = "Arial"
            p.space_after = Pt(7)

    # ==========================================
    # SLIDE 7: HKC DOCS & IN-APP CAMERA CAPTURE
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    add_bg(s7)
    add_header(s7, "Paperless Trade Verification", "HKC Docs: In-App Camera Capture & Trade Vault", "Turning physical paper bottlenecks into instant digital proof attached directly to transactions.")

    # Left: Feature breakdown
    tf_docs = add_card(s7, 0.8, 2.05, 6.0, 4.8, "Digital Proof Pipeline", "Direct capture on phone, tablet or desktop", border_color=ACCENT_CYAN)
    doc_steps = [
        ("Live In-Browser Camera Capture", "Warehouse clerks capture physical delivery notes, customs stamps, and truck seals directly through the web app without external scanners."),
        ("Multi-Document Attachment Matrix", "Attach Bills of Lading, Phytosanitary Certificates, Bank Forex permits, Commercial Invoices, and Packing Lists to any Sales or Purchase record."),
        ("Built-in Inspection Viewer", "Interactive zoom, page rotation, and preview modal for PDFs and high-res photos without downloading files locally."),
        ("Permanent Audit Immutability", "Uploaded documents are linked with cryptographic timestamps and user operator IDs, preventing document swapping or loss during customs reviews.")
    ]
    for t, d in doc_steps:
        p_t = tf_docs.add_paragraph()
        p_t.text = t
        p_t.font.size = Pt(12)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_CYAN
        p_t.font.name = "Arial"
        p_t.space_before = Pt(4)

        p_d = tf_docs.add_paragraph()
        p_d.text = d
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = TEXT_LIGHT
        p_d.font.name = "Arial"
        p_d.space_after = Pt(4)

    # Right: The Trade Document Taxonomy
    tf_tax = add_card(s7, 7.0, 2.05, 5.5, 4.8, "Pre-Configured Document Taxonomy", "Standardized for Ethiopian Import/Export", border_color=CARD_BORDER_ACTIVE)
    doc_categories = [
        ("Customs & Border Declarations", "Djibouti Transit Documents, Single Administrative Documents (SAD), Port Clearing Tallies"),
        ("Quality & Quarantine Certificates", "Phytosanitary Certificates, Ethiopian FDA Release Vouchers, ECX Grade Slips"),
        ("Banking & Forex Records", "Bank Permit Letters, NBE FX Approval Notices, Letters of Credit (LC), Swift Confirmations"),
        ("Commercial & Transport Vouchers", "Commercial Invoices, Bills of Lading (BoL), Delivery Notes, Consignment Notes, Waybills")
    ]
    for cat, items in doc_categories:
        p_cat = tf_tax.add_paragraph()
        p_cat.text = f"• {cat}"
        p_cat.font.size = Pt(11.5)
        p_cat.font.bold = True
        p_cat.font.color.rgb = ACCENT_AMBER
        p_cat.font.name = "Arial"
        p_cat.space_before = Pt(4)

        p_it = tf_tax.add_paragraph()
        p_it.text = items
        p_it.font.size = Pt(10.5)
        p_it.font.color.rgb = TEXT_LIGHT
        p_it.font.name = "Arial"
        p_it.space_after = Pt(6)

    # ==========================================
    # SLIDE 8: HR & ETHIOPIAN LABOUR LAW PAYROLL
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    add_bg(s8)
    add_header(s8, "Human Resource Management", "Workforce Governance & Ethiopian Statutory Payroll", "Fully automated income tax brackets, pension fund compliance, and complete employee lifecycle management.")

    hr_cards = [
        ("Statutory Income Tax Brackets", "Proclamation Compliant", [
            "• Precise progressive Ethiopian income tax computation (0% up to 35%).",
            "• Automatic non-taxable basic allowance exclusion.",
            "• Separate calculation for taxable allowances (transport, representation) vs non-taxable exemptions.",
            "• Eliminates monthly tax accounting errors and penalty exposures."
        ], ACCENT_AMBER),
        ("Automated Pension Funds", "Social Security Agency", [
            "• Automatic calculation of 7% Employee Pension deduction.",
            "• Automatic computation of 11% Employer Pension contribution (Total 18%).",
            "• Generates official monthly Pension Summary Schedules ready for submission to the Private Organizations Employees Pension Agency (POEPA)."
        ], ACCENT_CYAN),
        ("Lifecycle & Attendance Suite", "Hire to Separation", [
            "• Biometric / digital daily attendance and overtime multiplier calculations.",
            "• Leave ledger: annual leave accrual, sick leave, maternity leave, and emergency quota.",
            "• Recruitment pipeline, contract renewal alerts, and structured separation severance calculation."
        ], ACCENT_GREEN)
    ]

    for i, (c_title, c_sub, bullets, col) in enumerate(hr_cards):
        x = 0.8 + (i * 4.0)
        tf = add_card(s8, x, 2.05, 3.75, 4.8, c_title, c_sub, border_color=col)
        for b in bullets:
            p = tf.add_paragraph()
            p.text = b
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_LIGHT
            p.font.name = "Arial"
            p.space_after = Pt(7)

    # ==========================================
    # SLIDE 9: EXECUTIVE CONTROL CENTER
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    add_bg(s9)
    add_header(s9, "Executive Cockpit", "Executive Control Center & 360° Real-Time Auditability", "Empowering leadership with instant financial visibility, aged receivables, and tamper-evident audit logs.")

    # 4 Cards Layout (2x2 Grid)
    grid_cards = [
        (0.8, 2.05, 5.7, 2.3, "Real-Time Financial Cockpit", "Live Treasury & Margin Tracking", [
            "• Consolidated revenue velocity across agricultural export and veterinary distribution.",
            "• Gross profit margins calculated per product batch, customer, and warehouse.",
            "• Live liquidity counter tracking cash at hand and bank balances across all Ethiopian bank accounts."
        ], ACCENT_GREEN),
        (6.8, 2.05, 5.7, 2.3, "Customer Receivables & Aging Radar", "Credit Risk Prevention", [
            "• Multi-tier aged receivables ledger: 0-30, 31-60, 61-90, and 90+ days overdue.",
            "• Automatic credit limit enforcement: blocks unauthorized new dispatches to delinquent accounts.",
            "• Printable customer statements and credit sales attachment vouchers."
        ], ACCENT_AMBER),
        (0.8, 4.55, 5.7, 2.3, "Unified Multi-Tier Approval Gates", "Institutional Governance", [
            "• Multi-level sign-offs for high-value sales orders, credit issues, and price overrides.",
            "• Inventory write-offs and quarantine releases require dual management authorization.",
            "• Mobile-friendly approval queue for executives on the move."
        ], ACCENT_PURPLE),
        (6.8, 4.55, 5.7, 2.3, "Tamper-Evident Immutable Audit Log", "Forensic Accountability", [
            "• Every user click, status update, price modification, and login event is permanently captured.",
            "• Zero-delay log synchronization: no action is unrecorded.",
            "• Pre-built search and filtering for internal auditors and external compliance reviews."
        ], ACCENT_CYAN)
    ]

    for (x, y, w, h, c_title, c_sub, bullets, col) in grid_cards:
        tf = add_card(s9, x, y, w, h, c_title, c_sub, border_color=col)
        for b in bullets:
            p = tf.add_paragraph()
            p.text = b
            p.font.size = Pt(10.5)
            p.font.color.rgb = TEXT_LIGHT
            p.font.name = "Arial"
            p.space_after = Pt(3)

    # ==========================================
    # SLIDE 10: CUTTING-EDGE TECH STACK
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    add_bg(s10)
    add_header(s10, "Engineering & Architecture", "Modern Tech Stack: Speed, Security & Zero Spinners", "Constructed using top-tier enterprise web technologies for instantaneous responsiveness and offline reliability.")

    tech_columns = [
        ("Frontend: 60fps Experience", "Modern React 19 Ecosystem", [
            "• React 19 & Vite 7: Sub-millisecond HMR and lightning build pipeline.",
            "• Tailwind CSS v4: Micro-animations, responsive layout, ultra-clean code.",
            "• Zero Spinner Rule: High-polish pulse skeleton screens replace disruptive loading spinners.",
            "• Framer Motion & Radix UI: Accessible, keyboard-navigable modern modals and drawers."
        ], ACCENT_CYAN),
        ("Backend: High-Throughput REST", "Node.js 22 & Express 5", [
            "• Express 5 Engine: Clean asynchronous pipeline with robust error boundaries.",
            "• Drizzle ORM: Type-safe SQL schema design, zero runtime overhead, instant queries.",
            "• Multi-Environment Persistence: Local MySQL 8 with Plesk production export compatibility.",
            "• Enterprise JWT & Bcrypt: Secure token refresh cycles and hashed credential vaults."
        ], ACCENT_GREEN),
        ("Security: Granular RBAC", "Role-Based Access Control", [
            "• Tailored Roles: Super Admin, Sales Manager, Finance Manager, Inventory Manager, HR Manager, Operator, Auditor.",
            "• Warehouse-Level Scoping: Clerks only see permitted warehouses (e.g. WH1 vs WH2).",
            "• Session Inactivity Guard: Auto-warning modal preventing unattended terminal hijacking.",
            "• Multi-tenant & branch expansion ready."
        ], ACCENT_PURPLE)
    ]

    for i, (c_title, c_sub, bullets, col) in enumerate(tech_columns):
        x = 0.8 + (i * 4.0)
        tf = add_card(s10, x, 2.05, 3.75, 4.8, c_title, c_sub, border_color=col)
        for b in bullets:
            p = tf.add_paragraph()
            p.text = b
            p.font.size = Pt(11)
            p.font.color.rgb = TEXT_LIGHT
            p.font.name = "Arial"
            p.space_after = Pt(7)

    # ==========================================
    # SLIDE 11: MEASURABLE ROI & BUSINESS IMPACT
    # ==========================================
    s11 = prs.slides.add_slide(blank_layout)
    add_bg(s11)
    add_header(s11, "Value Realization", "Proven Business Impact: High-Velocity Return on Investment", "Quantifiable operational breakthroughs delivered across HKC Trading's export and import operations.")

    metrics = [
        ("-85%", "Customs Turnaround Delay", "Immediate retrieval of scanned Phytosanitary and Origin certificates slashes border clearance wait time.", ACCENT_GREEN),
        ("0%", "Expired Medicine Losses", "Automated FEFO dispatch and 30-day early warning alarms eradicate expired veterinary pharmaceutical inventory.", ACCENT_PURPLE),
        ("3.2x", "Faster Month-End Closing", "1-Click Peachtree sync and automated COA split rules cut finance reconciliation from 12 days to under 4 days.", ACCENT_AMBER),
        ("100%", "Audit & Tax Compliance", "Zero tax calculation discrepancies across ERCA VAT, WHT, and employee pension schedules.", ACCENT_CYAN)
    ]

    for i, (metric_val, metric_label, metric_desc, m_col) in enumerate(metrics):
        x = 0.8 + (i * 3.0)
        card = s11.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(2.1), Inches(2.75), Inches(4.7))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = m_col
        card.line.width = Pt(1.5)

        tf = card.text_frame
        tf.word_wrap = True
        
        # Big number
        p_num = tf.paragraphs[0]
        p_num.text = metric_val
        p_num.font.size = Pt(44)
        p_num.font.bold = True
        p_num.font.color.rgb = m_col
        p_num.font.name = "Arial"
        p_num.alignment = PP_ALIGN.CENTER
        
        # Metric Label
        p_lbl = tf.add_paragraph()
        p_lbl.text = metric_label.upper()
        p_lbl.font.size = Pt(12)
        p_lbl.font.bold = True
        p_lbl.font.color.rgb = TEXT_WHITE
        p_lbl.font.name = "Arial"
        p_lbl.alignment = PP_ALIGN.CENTER
        p_lbl.space_before = Pt(8)
        p_lbl.space_after = Pt(12)

        # Description
        p_desc = tf.add_paragraph()
        p_desc.text = metric_desc
        p_desc.font.size = Pt(10.5)
        p_desc.font.color.rgb = TEXT_LIGHT
        p_desc.font.name = "Arial"
        p_desc.alignment = PP_ALIGN.CENTER

    # ==========================================
    # SLIDE 12: STRATEGIC ROADMAP & CLOSING
    # ==========================================
    s12 = prs.slides.add_slide(blank_layout)
    add_bg(s12)
    add_header(s12, "Strategic Horizon", "Roadmap: The Future of HKC Intelligent Logistics", "From foundational multi-hub automation to real-time IoT and predictive trade intelligence.")

    # 3 Phase Cards
    phases = [
        ("Phase 1: Operational Core", "Current Milestone • 100% Deployed", [
            "✔ Tri-Hub Warehouse Architecture (WH1, WH2, WH3)",
            "✔ Toll Processing & Shrinkage Calculation Ledger",
            "✔ FEFO Expiry Radar & Quarantine Matrix",
            "✔ Peachtree Dual Sync & Ethiopian Tax Engine",
            "✔ Digital HKC Docs & Statutory HR/Payroll"
        ], ACCENT_GREEN),
        ("Phase 2: Mobile & Realtime IoT", "Immediate Next Horizon (Q4 2026)", [
            "➤ Handheld Rugged Barcode / QR Scanners on warehouse floor",
            "➤ IoT Cold-Chain Temperature Telemetry for Vaccine storage",
            "➤ Automated SMS / Telegram Customer Dispatch Alerts",
            "➤ Direct Electronic Bank API integration for CBE & Awash",
            "➤ Multi-branch expansion to Hawassa and Dire Dawa"
        ], ACCENT_CYAN),
        ("Phase 3: AI Predictive Trade", "Vision 2027", [
            "★ AI Commodity Price Forecasting for Coffee & Sesame (ECX trends)",
            "★ Port Djibouti Automated EDI Manifest Sync",
            "★ Machine Learning Supplier Yield Prediction",
            "★ Autonomous Reorder Point Optimization for Veterinary Drugs",
            "★ Pan-African Cross-Border Settlement Ready"
        ], ACCENT_AMBER)
    ]

    for i, (p_title, p_sub, points, col) in enumerate(phases):
        x = 0.8 + (i * 4.0)
        tf = add_card(s12, x, 2.05, 3.75, 4.0, p_title, p_sub, border_color=col)
        for pt in points:
            p = tf.add_paragraph()
            p.text = pt
            p.font.size = Pt(10.5)
            p.font.color.rgb = TEXT_LIGHT
            p.font.name = "Arial"
            p.space_after = Pt(5)

    # Bottom Call to Action Banner
    cta_box = s12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(6.2), Inches(11.733), Inches(0.8))
    cta_box.fill.solid()
    cta_box.fill.fore_color.rgb = RGBColor(16, 26, 46)
    cta_box.line.color.rgb = ACCENT_GREEN
    cta_box.line.width = Pt(1.5)
    
    tf_cta = cta_box.text_frame
    tf_cta.vertical_anchor = MSO_ANCHOR.MIDDLE
    p_cta = tf_cta.paragraphs[0]
    p_cta.text = "HKC ERP v5: Empowering Ethiopian Agricultural & Healthcare Trade with Sovereign Tech Excellence"
    p_cta.font.size = Pt(13)
    p_cta.font.bold = True
    p_cta.font.color.rgb = TEXT_WHITE
    p_cta.font.name = "Arial"
    p_cta.alignment = PP_ALIGN.CENTER

    output_path = "/Users/Noah/Documents/React/HKC-ERP-v5/HKC_ERP_v5_Executive_Presentation.pptx"
    prs.save(output_path)
    print(f"Presentation saved successfully to {output_path}")

if __name__ == "__main__":
    create_deck()
