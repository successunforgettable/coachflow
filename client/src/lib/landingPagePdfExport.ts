import jsPDF from 'jspdf';

/**
 * Specialized PDF Export for Landing Pages
 * Preserves Industry visual styling: dark theme, purple CTAs, red eyebrows, Inter font
 */

interface LandingPageAngle {
  eyebrowHeadline: string;
  mainHeadline: string;
  subheadline: string;
  primaryCta: string;
  asSeenIn: string[];
  quizSection: {
    question: string;
    options: string[];
    answer: string;
  };
  problemAgitation: string;
  solutionIntro: string;
  whyOldFail: string;
  uniqueMechanism: string;
  testimonials: Array<{
    headline: string;
    quote: string;
    name: string;
    location: string;
  }>;
  insiderAdvantages: string;
  scarcityUrgency: string;
  shockingStat: string;
  timeSavingBenefit: string;
  consultationOutline: Array<{
    title: string;
    description: string;
  }>;
}

interface LandingPagePDFOptions {
  productName: string;
  angle: 'original' | 'godfather' | 'free' | 'dollar';
  angleData: LandingPageAngle;
}

/**
 * Export landing page to PDF with Industry visual styling
 */
export function exportLandingPageToPDF(options: LandingPagePDFOptions): void {
  const { productName, angle, angleData } = options;
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);

  // Helper function to check and add new page
  const checkPageBreak = (requiredSpace: number = 30) => {
    if (yPosition > pageHeight - requiredSpace) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Helper function to add section title
  const addSectionTitle = (title: string, color: 'red' | 'purple' | 'black' = 'black') => {
    checkPageBreak(15);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    if (color === 'red') {
      doc.setTextColor(255, 51, 102); // #ff3366
    } else if (color === 'purple') {
      doc.setTextColor(139, 92, 246); // #8B5CF6
    } else {
      doc.setTextColor(0, 0, 0);
    }
    
    doc.text(title.toUpperCase(), margin, yPosition);
    yPosition += 8;
  };

  // Helper function to add body text
  const addBodyText = (text: string, fontSize: number = 11, bold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(40, 40, 40);
    
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      checkPageBreak();
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.5;
    });
    yPosition += 3;
  };

  // Header - ZAP branding
  doc.setFontSize(10);
  doc.setTextColor(139, 92, 246); // Purple
  doc.setFont('helvetica', 'bold');
  doc.text('ZAP', margin, yPosition);
  
  // Angle badge
  const angleName = angle.charAt(0).toUpperCase() + angle.slice(1);
  const angleText = angle === 'original' ? 'ORIGINAL' : 
                    angle === 'godfather' ? 'GODFATHER OFFER' :
                    angle === 'free' ? 'FREE OFFER' : 'DOLLAR OFFER';
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(139, 92, 246);
  const badgeWidth = doc.getTextWidth(angleText) + 6;
  doc.roundedRect(pageWidth - margin - badgeWidth, yPosition - 4, badgeWidth, 6, 1, 1, 'F');
  doc.text(angleText, pageWidth - margin - badgeWidth + 3, yPosition);
  
  yPosition += 15;

  // Product name
  doc.setFontSize(14);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text(`Product: ${productName}`, margin, yPosition);
  yPosition += 10;

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 12;

  // 1. EYEBROW + MAIN HEADLINE + SUBHEADLINE
  addSectionTitle(angleData.eyebrowHeadline, 'red');
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const headlineLines = doc.splitTextToSize(angleData.mainHeadline, maxWidth);
  headlineLines.forEach((line: string) => {
    checkPageBreak();
    doc.text(line, margin, yPosition);
    yPosition += 9;
  });
  yPosition += 5;

  addBodyText(angleData.subheadline, 12);
  yPosition += 5;

  // CTA Button (visual representation)
  doc.setFillColor(139, 92, 246); // Purple
  doc.roundedRect(margin, yPosition, 60, 10, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(angleData.primaryCta, margin + 30, yPosition + 6.5, { align: 'center' });
  yPosition += 18;

  // 2. AS SEEN IN
  if (angleData.asSeenIn && angleData.asSeenIn.length > 0) {
    addSectionTitle('AS SEEN IN', 'purple');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(angleData.asSeenIn.join(' • '), margin, yPosition);
    yPosition += 12;
  }

  // 3. QUIZ SECTION
  if (angleData.quizSection) {
    addSectionTitle('QUICK QUIZ', 'purple');
    addBodyText(angleData.quizSection.question, 11, true);
    
    angleData.quizSection.options.forEach((option, index) => {
      checkPageBreak();
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.text(`${String.fromCharCode(65 + index)}. ${option}`, margin + 5, yPosition);
      yPosition += 6;
    });
    
    yPosition += 3;
    doc.setFontSize(10);
    doc.setTextColor(139, 92, 246);
    doc.setFont('helvetica', 'bold');
    doc.text(`✓ Answer: ${angleData.quizSection.answer}`, margin, yPosition);
    yPosition += 12;
  }

  // 4. PROBLEM AGITATION
  addSectionTitle('THE PROBLEM', 'red');
  addBodyText(angleData.problemAgitation);
  yPosition += 8;

  // 5. SOLUTION INTRODUCTION
  addSectionTitle('THE SOLUTION', 'purple');
  addBodyText(angleData.solutionIntro);
  yPosition += 8;

  // 6. WHY OLD METHODS FAIL
  addSectionTitle('WHY OLD METHODS FAIL', 'red');
  addBodyText(angleData.whyOldFail);
  yPosition += 8;

  // 7. UNIQUE MECHANISM
  addSectionTitle('THE UNIQUE MECHANISM', 'purple');
  addBodyText(angleData.uniqueMechanism);
  yPosition += 8;

  // 8. TESTIMONIALS
  if (angleData.testimonials && angleData.testimonials.length > 0) {
    addSectionTitle('SUCCESS STORIES', 'purple');
    
    angleData.testimonials.forEach((testimonial, index) => {
      checkPageBreak(25);
      
      // Testimonial box
      doc.setDrawColor(139, 92, 246);
      doc.setLineWidth(0.5);
      const boxHeight = 22;
      doc.rect(margin, yPosition, maxWidth, boxHeight);
      
      yPosition += 5;
      
      // Headline
      doc.setFontSize(10);
      doc.setTextColor(139, 92, 246); // Purple
      doc.setFont('helvetica', 'bold');
      doc.text(testimonial.headline, margin + 3, yPosition);
      yPosition += 5;
      
      // Quote
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'italic');
      const testimonialLines = doc.splitTextToSize(`"${testimonial.quote}"`, maxWidth - 6);
      testimonialLines.slice(0, 2).forEach((line: string) => {
        doc.text(line, margin + 3, yPosition);
        yPosition += 4;
      });
      
      // Name and location
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`- ${testimonial.name}, ${testimonial.location}`, margin + 3, yPosition);
      
      yPosition += 8;
    });
    
    yPosition += 5;
  }

  // 9. INSIDER ADVANTAGES
  addSectionTitle('INSIDER ADVANTAGES', 'purple');
  addBodyText(angleData.insiderAdvantages);
  yPosition += 8;

  // 10. SCARCITY/URGENCY
  addSectionTitle('LIMITED TIME OFFER', 'red');
  addBodyText(angleData.scarcityUrgency);
  yPosition += 8;

  // 11. SHOCKING STATISTIC
  addSectionTitle('DID YOU KNOW?', 'red');
  addBodyText(angleData.shockingStat, 12, true);
  yPosition += 8;

  // 12. TIME-SAVING BENEFIT
  addSectionTitle('SAVE TIME & EFFORT', 'purple');
  addBodyText(angleData.timeSavingBenefit);
  yPosition += 8;

  // 13. CONSULTATION OUTLINE
  if (angleData.consultationOutline && angleData.consultationOutline.length > 0) {
    addSectionTitle('WHAT YOU\'LL GET', 'purple');
    
    angleData.consultationOutline.forEach((item, index) => {
      checkPageBreak();
      
      // Numbered list
      doc.setFontSize(10);
      doc.setTextColor(139, 92, 246);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}.`, margin, yPosition);
      
      // Title
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(item.title, margin + 8, yPosition);
      yPosition += 5;
      
      // Description
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(item.description, maxWidth - 10);
      doc.text(descLines, margin + 8, yPosition);
      yPosition += descLines.length * 5 + 3;
    });
    
    yPosition += 5;
  }

  // FINAL CTA
  checkPageBreak(20);
  doc.setFillColor(139, 92, 246);
  doc.roundedRect(margin, yPosition, maxWidth, 12, 2, 2, 'F');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(angleData.primaryCta, pageWidth / 2, yPosition + 8, { align: 'center' });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'Generated by ZAP',
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${angle}_landing_page_${timestamp}.pdf`;

  // Save the PDF
  doc.save(filename);
}
