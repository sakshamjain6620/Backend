const PDFDocument = require('pdfkit');
require('dotenv').config();

const CLINIC_NAME = process.env.CLINIC_NAME || 'SwasthSetu Health Clinic';
const CLINIC_ADDRESS = process.env.CLINIC_ADDRESS || '123 Healthcare Avenue, Mumbai';
const CLINIC_PHONE = process.env.CLINIC_PHONE || '+91 98765 43210';
const CLINIC_EMAIL = process.env.CLINIC_EMAIL || 'care@swasthsetu.health';

/**
 * Helper to draw a header letterhead
 */
function drawHeader(doc) {
    // Header background bar (Teal color)
    doc.rect(0, 0, 612, 100).fill('#14B8A6');
    
    // Clinic Branding
    doc.fillColor('#FFFFFF')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(CLINIC_NAME, 40, 25);
       
    doc.fontSize(10)
       .font('Helvetica')
       .text(`${CLINIC_ADDRESS} | Ph: ${CLINIC_PHONE} | Email: ${CLINIC_EMAIL}`, 40, 60);

    // Decorative line below header
    doc.moveTo(0, 100).lineTo(612, 100).lineWidth(3).stroke('#059669');
}

/**
 * Helper to draw a footer
 */
function drawFooter(doc) {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fillColor('#9CA3AF')
           .fontSize(8)
           .text('This is a computer-generated document. For query support, please email us.', 40, 740, { align: 'center', width: 532 });
        doc.text(`Page ${i + 1} of ${pageCount}`, 40, 755, { align: 'right', width: 532 });
    }
}

/**
 * Generates prescription PDF
 */
const generatePrescriptionPDF = (prescription, doctor, patient, medicines) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, bufferPages: true });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });

            drawHeader(doc);

            // Left column - Patient info
            doc.fillColor('#1F2937').fontSize(12).font('Helvetica-Bold').text('PATIENT DETAILS', 40, 125);
            doc.font('Helvetica').fontSize(10)
               .text(`Name: ${patient.name}`)
               .text(`Age/Gender: ${patient.age} / ${patient.gender}`)
               .text(`Phone: ${patient.phone}`)
               .text(`Email: ${patient.email}`);

            // Right column - Doctor / Date info
            doc.font('Helvetica-Bold').fontSize(12).text('CONSULTANT DETAILS', 350, 125);
            doc.font('Helvetica').fontSize(10)
               .text(`Doctor: ${doctor.name}`)
               .text(`Specialization: ${doctor.specialization}`)
               .text(`Date: ${new Date(prescription.created_at || Date.now()).toLocaleDateString()}`)
               .text(`Prescription ID: ${prescription.id.slice(0, 8)}`);

            // Divider line
            doc.moveTo(40, 200).lineTo(572, 200).lineWidth(1).stroke('#E5E7EB');

            // Rx logo
            doc.fillColor('#14B8A6').fontSize(22).font('Helvetica-Bold').text('Rx', 40, 215);

            // Diagnosis
            doc.fillColor('#1F2937').fontSize(11).font('Helvetica-Bold').text('Diagnosis / Clinical Summary:', 40, 245);
            doc.font('Helvetica').fontSize(10).text(prescription.diagnosis || 'General Checkup', 40, 260);

            // Table headers for medicines
            let y = 300;
            doc.rect(40, y, 532, 20).fill('#F3F4F6');
            doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold')
               .text('Medicine Name', 45, y + 6, { width: 150 })
               .text('Dosage', 200, y + 6, { width: 80 })
               .text('Schedule/Timing', 290, y + 6, { width: 120 })
               .text('Duration', 420, y + 6, { width: 60 })
               .text('Food Instructions', 490, y + 6, { width: 80 });

            // Medicines rows
            y += 20;
            doc.font('Helvetica').fontSize(9).fillColor('#1F2937');
            
            medicines.forEach((med, idx) => {
                // Background stripe for alternate rows
                if (idx % 2 === 1) {
                    doc.rect(40, y, 532, 20).fill('#F9FAFB');
                    doc.fillColor('#1F2937'); // Reset color
                }
                
                doc.text(med.medicine_name, 45, y + 6, { width: 150 })
                   .text(med.dosage, 200, y + 6, { width: 80 })
                   .text(med.timing, 290, y + 6, { width: 120 })
                   .text(`${med.duration_days} Days`, 420, y + 6, { width: 60 })
                   .text(med.before_after_food || 'N/A', 490, y + 6, { width: 80 });
                   
                y += 20;
            });

            // Follow Up & General Instructions
            doc.fillColor('#1F2937').fontSize(11).font('Helvetica-Bold').text('Doctor Instructions & Advice:', 40, y + 20);
            doc.font('Helvetica').fontSize(10).text(prescription.instructions || 'Drink plenty of water and rest.', 40, y + 35, { width: 300 });

            if (prescription.follow_up_date) {
                doc.font('Helvetica-Bold').text(`Follow Up Date: ${prescription.follow_up_date}`, 40, y + 70);
            }

            // Doctor's Signature line on bottom right
            doc.moveTo(400, 650).lineTo(550, 650).lineWidth(1).stroke('#9CA3AF');
            doc.fillColor('#374151').fontSize(9).font('Helvetica')
               .text(`Dr. ${doctor.name}`, 400, 658, { align: 'center', width: 150 })
               .text(doctor.specialization, 400, 670, { align: 'center', width: 150 });

            drawFooter(doc);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Generates clinical visit summary PDF
 */
const generateVisitSummaryPDF = (record, doctor, patient) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, bufferPages: true });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });

            drawHeader(doc);

            // Title
            doc.fillColor('#1F2937').fontSize(16).font('Helvetica-Bold').text('CLINICAL VISIT SUMMARY', 40, 120, { align: 'center' });

            // Grid Layout
            doc.fontSize(12).font('Helvetica-Bold').text('PATIENT INFO', 40, 160);
            doc.font('Helvetica').fontSize(10)
               .text(`Name: ${patient.name}`)
               .text(`Age / Gender: ${patient.age} / ${patient.gender}`)
               .text(`Contact: ${patient.phone}`);

            doc.font('Helvetica-Bold').fontSize(12).text('CONSULTATION INFO', 350, 160);
            doc.font('Helvetica').fontSize(10)
               .text(`Consultant: Dr. ${doctor.name}`)
               .text(`Department: ${doctor.specialization}`)
               .text(`Visit Date: ${new Date(record.created_at).toLocaleDateString()}`);

            doc.moveTo(40, 230).lineTo(572, 230).lineWidth(1).stroke('#E5E7EB');

            // Symptoms
            doc.fillColor('#1F2937').fontSize(12).font('Helvetica-Bold').text('Symptoms Reported:', 40, 250);
            doc.font('Helvetica').fontSize(10).text(record.symptoms || 'None reported', 40, 265, { width: 500 });

            // Diagnosis
            doc.fontSize(12).font('Helvetica-Bold').text('Diagnosis / Findings:', 40, 310);
            doc.font('Helvetica').fontSize(10).text(record.diagnosis || 'Routine General Consultation', 40, 325, { width: 500 });

            // Clinical Notes
            doc.fontSize(12).font('Helvetica-Bold').text('Doctor Notes:', 40, 370);
            doc.font('Helvetica').fontSize(10).text(record.doctor_notes || 'No detailed clinical notes provided.', 40, 385, { width: 500 });

            // Advice / Follow up
            doc.fontSize(12).font('Helvetica-Bold').text('Follow-Up & Advice:', 40, 470);
            doc.font('Helvetica').fontSize(10).text(record.follow_up_advice || 'Review if symptoms persist.', 40, 485, { width: 500 });

            // Signature
            doc.moveTo(400, 650).lineTo(550, 650).lineWidth(1).stroke('#9CA3AF');
            doc.fillColor('#374151').fontSize(9).font('Helvetica')
               .text(`Dr. ${doctor.name}`, 400, 658, { align: 'center', width: 150 })
               .text('Authorized Clinician Signature', 400, 670, { align: 'center', width: 150 });

            drawFooter(doc);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = {
    generatePrescriptionPDF,
    generateVisitSummaryPDF
};
