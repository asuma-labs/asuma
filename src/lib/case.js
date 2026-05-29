import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CASE_FILE = path.join(process.cwd(), 'Asuma.js');
const START_MARKER = '// [START CASES]';
const END_MARKER = '// [END CASES]';

const readCaseFile = () => {
    if (!fs.existsSync(CASE_FILE)) {
        throw new Error(`${CASE_FILE} not found!`);
    }
    return fs.readFileSync(CASE_FILE, 'utf8');
};

const writeCaseFile = (content) => {
    fs.writeFileSync(CASE_FILE, content);
};

const extractCaseBlock = (content, caseName) => {
    const regex = new RegExp(`case\\s+["'\`]${caseName}["'\`]\\s*:`, 'g');
    const match = regex.exec(content);
    
    if (!match) throw new Error(`Case "${caseName}" not found`);
    
    const startIndex = match.index;
    let braceIndex = content.indexOf('{', startIndex);
    if (braceIndex === -1) throw new Error(`Invalid case block for "${caseName}"`);
    
    let depth = 1;
    let endIndex = braceIndex + 1;
    
    while (depth > 0 && endIndex < content.length) {
        if (content[endIndex] === '{') depth++;
        if (content[endIndex] === '}') depth--;
        endIndex++;
    }
    
    return content.slice(startIndex, endIndex);
};

export const Case = {
    get: (name) => {
        const content = readCaseFile();
        return extractCaseBlock(content, name);
    },

    add: (code) => {
        if (!code.includes('case')) throw new Error('Must contain "case"');
        if (!code.includes('{') || !code.includes('}')) throw new Error('Missing { } block');
        if (!code.includes('break')) throw new Error('Missing "break" statement');

        const content = readCaseFile();
        
        const nameMatch = code.match(/case\s+["'\`](.*?)["'\`]\s*:/);
        if (nameMatch) {
            const caseName = nameMatch[1];
            if (new RegExp(`case\\s+["'\`]${caseName}["'\`]\\s*:`).test(content)) {
                throw new Error(`Case "${caseName}" already exists!`);
            }
        }

        const endIndex = content.indexOf(END_MARKER);
        if (endIndex === -1) throw new Error(`${END_MARKER} not found in Asuma.js`);

        const newContent = content.slice(0, endIndex) + 
                          `  ${code.trim()}\n\n            ` + 
                          content.slice(endIndex);
        
        writeCaseFile(newContent);
        return `Case added successfully!`;
    },

    delete: (name) => {
        const content = readCaseFile();
        
        try {
            const caseBlock = extractCaseBlock(content, name);
            const newContent = content.replace(caseBlock, '').replace(/\n\s*\n\s*\n/g, '\n\n');
            writeCaseFile(newContent);
            return `Case "${name}" deleted successfully!`;
        } catch (error) {
            throw new Error(`Failed to delete "${name}": ${error.message}`);
        }
    },

    list: () => {
        const content = readCaseFile();
        const regex = /case\s+["'\`](.*?)["'\`]\s*:/g;
        const cases = [];
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            if (match[1] !== 'default') {
                cases.push(match[1]);
            }
        }
        
        return cases.length ? cases.join('\n') : 'No cases found!';
    }
};

export default Case;
