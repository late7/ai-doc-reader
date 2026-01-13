// Simple test to verify docx library works
const { Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat, AlignmentType } = require('docx');

async function test() {
    try {
        console.log('Creating document...');

        const doc = new Document({
            numbering: {
                config: [{
                    reference: 'default-numbering',
                    levels: [{
                        level: 0,
                        format: LevelFormat.DECIMAL,
                        text: '%1.',
                        alignment: AlignmentType.START,
                    }],
                }],
            },
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: "Hello World!", bold: true })],
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        children: [new TextRun("This is a test paragraph.")],
                    }),
                ],
            }],
        });

        console.log('Generating buffer...');
        const buffer = await Packer.toBuffer(doc);
        console.log('Success! Buffer size:', buffer.length);

    } catch (error) {
        console.error('Error:', error);
    }
}

test();
