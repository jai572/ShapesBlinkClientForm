import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SALON_NAME } from "@/lib/constants";
import type { Consultation } from "@/lib/types";

export function generateConsultationPDF(entry: Consultation, signatureDataUrl: string | null) {
  const doc = new jsPDF();

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text(SALON_NAME, 105, 20, { align: "center" });
  doc.setFontSize(9);
  doc.text("PROFESSIONAL CLIENT CONSULTATION RECORD", 105, 30, { align: "center" });

  doc.setTextColor(30, 41, 59);
  let y = 55;

  const addSection = (title: string, bodyData: (string | null)[][]) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, 20, y);
    doc.line(20, y + 2, 190, y + 2);
    y += 10;
    autoTable(doc, {
      startY: y,
      body: bodyData,
      theme: "plain",
      styles: { fontSize: 8.5 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50, textColor: [100, 116, 139] } },
    });
    y = (doc as any).lastAutoTable.finalY + 15;
  };

  addSection("CLIENT INFORMATION", [
    ["Full Name", `${entry.first_name} ${entry.last_name}`],
    ["Email Address", entry.email],
    ["Phone Number", entry.mobile],
    ["Home Address", entry.address ?? "N/A"],
  ]);

  const treatmentRows: (string | null)[][] = [
    ["Requested Service(s)", entry.requested_services.join(", ") || "N/A"],
    ["Previous Salon Visit", entry.been_to_salon ? "Yes" : "No"],
    ["Patch Test Status", entry.patch_test_status ? "Yes" : "No"],
  ];
  if (!entry.patch_test_status && entry.no_patch_consent !== null) {
    treatmentRows.push(["No-Patch Consent", entry.no_patch_consent ? "Yes" : "No"]);
  }
  addSection("TREATMENT DETAILS", treatmentRows);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("MEDICAL HISTORY", 20, y);
  doc.line(20, y + 2, 190, y + 2);

  if (entry.medical_conditions.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(220, 38, 38);
    doc.setFont("helvetica", "bold");
    doc.text(doc.splitTextToSize(entry.medical_conditions.join(", "), 170), 20, y + 10);
    doc.setTextColor(30, 41, 59);
  } else {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("No relevant medical conditions reported.", 20, y + 10);
  }

  y = 230;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    `I hereby confirm that all information provided is accurate and truthful. I understand that withholding medical ` +
      `details can lead to adverse reactions. I consent to the chosen treatment being performed by ${SALON_NAME}.`,
    20,
    y,
    { maxWidth: 170 }
  );

  if (signatureDataUrl) {
    doc.addImage(signatureDataUrl, "PNG", 20, y + 10, 50, 20);
  }

  doc.setFont("helvetica", "bold");
  doc.text(`Signed: ${entry.recipient_name}`, 20, y + 35);
  doc.text(`Date: ${entry.signed_date}`, 150, y + 35);

  doc.save(`${SALON_NAME.replace(/\s+/g, "_")}_Record_${entry.last_name}.pdf`);
}
