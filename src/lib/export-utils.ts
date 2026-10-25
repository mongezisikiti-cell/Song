import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { SeminarOutline } from '../types';

/**
 * Generates and downloads a Word document (.docx) for the given seminar outline.
 */
export async function exportToWord(outline: SeminarOutline, seminarTitle: string) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: seminarTitle.toUpperCase(),
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          
          // Description
          new Paragraph({
            children: [
              new TextRun({
                text: "Seminar Overview",
                bold: true,
                size: 28,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: outline.description,
            spacing: { after: 400 },
          }),

          // Sessions
          ...outline.sessions.flatMap((session, index) => [
            // Session Header
            new Paragraph({
              children: [
                new TextRun({
                  text: `Session ${index + 1}: ${session.title}`,
                  bold: true,
                  size: 32,
                  color: "D4AF37", // Gold-ish color
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
              border: {
                bottom: {
                  color: "D4AF37",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
            }),

            // Duration
            new Paragraph({
              children: [
                new TextRun({ text: "Duration: ", bold: true }),
                new TextRun({ text: session.duration }),
              ],
              spacing: { after: 200 },
            }),

            // Key Scriptures
            new Paragraph({
              children: [new TextRun({ text: "Key Scriptures:", bold: true })],
              spacing: { before: 200, after: 100 },
            }),
            ...session.keyScriptures.map(scripture => 
              new Paragraph({
                text: scripture,
                bullet: { level: 0 },
              })
            ),

            // Talking Points
            new Paragraph({
              children: [new TextRun({ text: "Teaching Points:", bold: true })],
              spacing: { before: 200, after: 100 },
            }),
            ...(session.detailedTalkingPoints ? 
              session.detailedTalkingPoints.flatMap(tp => [
                new Paragraph({
                  text: tp.point,
                  bullet: { level: 0 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "Deep Dive: ", bold: true, italics: true, size: 18 }),
                    new TextRun({ text: tp.deepDive, italics: true, size: 18, color: "666666" }),
                  ],
                  indent: { left: 720 },
                  spacing: { after: 200 },
                })
              ]) :
              session.talkingPoints.map(point => 
                new Paragraph({
                  text: point,
                  bullet: { level: 0 },
                })
              )
            ),

            // Prayer Focus
            new Paragraph({
              children: [
                new TextRun({ text: "Prayer Focus: ", bold: true }),
                new TextRun({ text: session.prayerFocus || "N/A" }),
              ],
              spacing: { before: 200, after: 400 },
            }),
          ]),

          // Full Sermon Section
          ...(outline.fullSermon ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: "FULL SERMON TEXT",
                  bold: true,
                  size: 32,
                  color: "D4AF37",
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
              border: {
                bottom: {
                  color: "D4AF37",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
            }),
            new Paragraph({
              text: outline.fullSermon,
              spacing: { after: 400 },
            }),
          ] : []),

          // Specialized Prayers Section
          ...(outline.specializedPrayers ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: "SPECIALIZED PRAYER POINTS",
                  bold: true,
                  size: 32,
                  color: "D4AF37",
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
              border: {
                bottom: {
                  color: "D4AF37",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
            }),
            ...outline.specializedPrayers.flatMap(prayer => [
              new Paragraph({
                children: [
                  new TextRun({ text: prayer.category.toUpperCase(), bold: true, color: "D4AF37", size: 20 }),
                ],
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: prayer.scripture, italics: true, size: 18, color: "666666" }),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                text: `"${prayer.prayer}"`,
                spacing: { after: 300 },
              }),
            ]),
          ] : []),

          // Podcast Script Section
          ...(outline.podcastScript ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: "PODCAST / PANEL DISCUSSION SCRIPT",
                  bold: true,
                  size: 32,
                  color: "D4AF37",
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
              border: {
                bottom: {
                  color: "D4AF37",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
            }),
            new Paragraph({
              text: outline.podcastScript,
              spacing: { after: 400 },
            }),
          ] : []),

          // Footer
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Generated by Seminar Builder - ${new Date().toLocaleDateString()}`,
                italics: true,
                size: 18,
                color: "888888",
              }),
            ],
            spacing: { before: 800 },
          }),
        ],
      },
    ],
  });

  // Generate the blob and trigger download
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${seminarTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_outline.docx`);
}
