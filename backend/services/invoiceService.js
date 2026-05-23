/**
 * SERVICE GÉNÉRATION DE FACTURES PDF
 * Utilise PDFKit pour créer des factures professionnelles
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const INVOICE_DIR = path.join(__dirname, '../invoices');
if (!fs.existsSync(INVOICE_DIR)) fs.mkdirSync(INVOICE_DIR, { recursive: true });

// Couleurs MadaBoutique
const COLORS = {
  green:      '#1D9E75',
  greenDark:  '#085041',
  greenLight: '#E1F5EE',
  gray:       '#6B7280',
  grayLight:  '#F3F4F6',
  black:      '#111827',
  white:      '#FFFFFF',
  border:     '#E5E7EB'
};

class InvoiceService {

  /**
   * Générer un PDF de facture et le sauvegarder sur disque
   * @returns {Promise<{filePath, fileName}>}
   */
  async generateInvoice(order, user) {
    return new Promise((resolve, reject) => {
      const fileName  = `${order.invoiceNumber}.pdf`;
      const filePath  = path.join(INVOICE_DIR, fileName);
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // ── En-tête ──────────────────────────────────────────
      this._drawHeader(doc, order);

      // ── Infos client & commande ──────────────────────────
      this._drawParties(doc, order, user);

      // ── Ligne séparatrice ────────────────────────────────
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(COLORS.border).lineWidth(1).stroke();
      doc.moveDown(0.5);

      // ── Tableau des articles ─────────────────────────────
      this._drawItemsTable(doc, order);

      // ── Totaux ───────────────────────────────────────────
      this._drawTotals(doc, order);

      // ── Badge paiement ───────────────────────────────────
      this._drawPaymentBadge(doc, order);

      // ── Pied de page ─────────────────────────────────────
      this._drawFooter(doc);

      doc.end();

      writeStream.on('finish', () => resolve({ filePath, fileName }));
      writeStream.on('error', reject);
    });
  }

  // ── En-tête avec logo ─────────────────────────────────────
  _drawHeader(doc, order) {
    // Rectangle vert en-tête
    doc.rect(0, 0, 595, 130).fill(COLORS.green);

    // Nom boutique
    doc.fillColor(COLORS.white)
       .font('Helvetica-Bold')
       .fontSize(28)
       .text('MadaBoutique', 50, 30);

    // Sous-titre
    doc.font('Helvetica')
       .fontSize(12)
       .fillColor('rgba(255,255,255,0.85)')
       .text('Facture de vente en ligne', 50, 65);

    // Numéro de facture (droite)
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor(COLORS.white)
       .text(`FACTURE`, 350, 30, { width: 195, align: 'right' });

    doc.font('Helvetica')
       .fontSize(22)
       .fillColor(COLORS.white)
       .text(order.invoiceNumber, 350, 50, { width: 195, align: 'right' });

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('rgba(255,255,255,0.75)')
       .text(`Date: ${new Date(order.updatedAt || order.createdAt).toLocaleDateString('fr-FR', {
         day: '2-digit', month: 'long', year: 'numeric'
       })}`, 350, 90, { width: 195, align: 'right' });

    doc.moveDown(5);
  }

  // ── Parties: vendeur & client ─────────────────────────────
  _drawParties(doc, order, user) {
    const y = 155;

    // Colonne vendeur
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.gray).text('VENDEUR', 50, y);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.black).text('MadaBoutique SARL', 50, y + 15);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray)
       .text('Analakely, Antananarivo 101', 50, y + 30)
       .text('Madagascar', 50, y + 43)
       .text('Tel: +261 34 000 0000', 50, y + 56)
       .text('info@madaboutique.mg', 50, y + 69);

    // Colonne client
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.gray).text('FACTURÉ À', 320, y);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.black).text(user.name, 320, y + 15);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray)
       .text(user.email, 320, y + 30)
       .text(user.phone, 320, y + 43)
       .text(order.address, 320, y + 56, { width: 200 });

    // Infos commande
    const infoY = y + 100;
    doc.rect(50, infoY, 495, 35).fill(COLORS.grayLight);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.black)
       .text(`N° Commande: ${order.orderNumber}`, 60, infoY + 11)
       .text(`Méthode: ${this._methodLabel(order.payment?.method)}`, 300, infoY + 11);

    doc.y = infoY + 50;
  }

  // ── Tableau des articles ──────────────────────────────────
  _drawItemsTable(doc, order) {
    const tableTop   = doc.y;
    const colWidths  = [250, 60, 90, 95];
    const cols       = [50, 300, 360, 450];
    const headers    = ['Produit / Description', 'Qté', 'Prix unitaire', 'Total'];

    // En-tête du tableau
    doc.rect(50, tableTop, 495, 28).fill(COLORS.greenDark);
    headers.forEach((h, i) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white)
         .text(h, cols[i], tableTop + 9, {
           width: colWidths[i],
           align: i === 0 ? 'left' : 'right'
         });
    });

    // Lignes articles
    let rowY = tableTop + 28;
    order.items.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? COLORS.white : COLORS.grayLight;
      doc.rect(50, rowY, 495, 28).fill(bg);

      doc.font('Helvetica').fontSize(10).fillColor(COLORS.black)
         .text(`${item.emoji || ''} ${item.name}`.trim(), cols[0], rowY + 9, { width: colWidths[0] })
         .text(String(item.qty),                                 cols[1], rowY + 9, { width: colWidths[1], align: 'right' })
         .text(this._fmt(item.price),                            cols[2], rowY + 9, { width: colWidths[2], align: 'right' })
         .text(this._fmt(item.price * item.qty),                 cols[3], rowY + 9, { width: colWidths[3], align: 'right' });

      rowY += 28;
    });

    // Ligne de clôture
    doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.y = rowY + 10;
  }

  // ── Totaux ────────────────────────────────────────────────
  _drawTotals(doc, order) {
    const startX = 340;
    let y = doc.y + 5;
    const labelW = 130;
    const valueW = 100;
    const valueX = startX + labelW + 15;

    const rows = [
      ['Sous-total',    this._fmt(order.subtotal),  false],
      ['Livraison',     this._fmt(order.delivery),  false],
      ['TVA (0%)',      '0 Ar',                      false],
      ['TOTAL',         this._fmt(order.total),      true]
    ];

    rows.forEach(([label, value, isTotal]) => {
      if (isTotal) {
        doc.rect(startX - 10, y - 3, 215, 28).fill(COLORS.green);
        doc.font('Helvetica-Bold').fontSize(12)
           .fillColor(COLORS.white)
           .text(label, startX, y + 4, { width: labelW })
           .text(value, valueX,  y + 4, { width: valueW, align: 'right' });
        y += 28;
      } else {
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray)
           .text(label, startX, y, { width: labelW })
           .font('Helvetica-Bold').fillColor(COLORS.black)
           .text(value, valueX, y, { width: valueW, align: 'right' });
        y += 20;
      }
    });

    doc.y = y + 15;
  }

  // ── Badge confirmation paiement ───────────────────────────
  _drawPaymentBadge(doc, order) {
    const y = doc.y + 5;
    doc.rect(50, y, 240, 50).fill(COLORS.greenLight);
    doc.circle(72, y + 25, 12).fill(COLORS.green);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white).text('✓', 67, y + 20);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.greenDark).text('PAIEMENT CONFIRMÉ', 90, y + 10);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray)
       .text(this._methodLabel(order.payment?.method), 90, y + 26)
       .text(order.payment?.transactionId ? `Réf: ${order.payment.transactionId}` : '', 90, y + 38);

    doc.y = y + 65;
  }

  // ── Pied de page ──────────────────────────────────────────
  _drawFooter(doc) {
    const pageHeight = doc.page.height;
    doc.moveTo(50, pageHeight - 70).lineTo(545, pageHeight - 70)
       .strokeColor(COLORS.border).lineWidth(0.5).stroke();

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray)
       .text('Merci pour votre achat chez MadaBoutique!', 50, pageHeight - 58, { align: 'center' })
       .text('Contact: +261 34 000 0000  |  info@madaboutique.mg  |  www.madaboutique.mg', 50, pageHeight - 45, { align: 'center' })
       .text('Ce document est une facture officielle. Conservez-la pour vos dossiers.', 50, pageHeight - 32, { align: 'center' });
  }

  _fmt(amount) {
    return new Intl.NumberFormat('fr-MG').format(amount) + ' Ar';
  }

  _methodLabel(method) {
    const labels = {
      'mvola':        'MVola (Telma)',
      'orange_money': 'Orange Money',
      'airtel_money': 'Airtel Money'
    };
    return labels[method] || method || 'Mobile Money';
  }

  /**
   * Générer le PDF et renvoyer le buffer (pour téléchargement direct)
   */
  async generateInvoiceBuffer(order, user) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this._drawHeader(doc, order);
      this._drawParties(doc, order, user);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(COLORS.border).lineWidth(1).stroke();
      doc.moveDown(0.5);
      this._drawItemsTable(doc, order);
      this._drawTotals(doc, order);
      this._drawPaymentBadge(doc, order);
      this._drawFooter(doc);
      doc.end();
    });
  }
}

module.exports = new InvoiceService();
