import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { PDFChunkManager } from './pdf-chunk-manager';
import { PDFProcessor } from './pdf-processor';
import fs from 'fs';
import path from 'path';

// Get the real Dirent class for mocking
const { Dirent } = jest.requireActual('fs') as typeof fs;

// Helper function to create mock Dirent objects
function createMockDirent(name: string): fs.Dirent {
    const dirent = new Dirent();
    Object.defineProperty(dirent, 'name', { value: name });
    // Use proper typing for the mock functions
    const mockTrue = () => true;
    const mockFalse = () => false;
    dirent.isFile = mockTrue;
    dirent.isDirectory = mockFalse;
    dirent.isBlockDevice = mockFalse;
    dirent.isCharacterDevice = mockFalse;
    dirent.isSymbolicLink = mockFalse;
    dirent.isFIFO = mockFalse;
    dirent.isSocket = mockFalse;
    return dirent;
}

// Mock dependencies
jest.mock('./pdf-processor');
jest.mock('fs');
jest.mock('path');

// Define chunk type to match PDFProcessor output
interface ProcessedChunk {
    text: string;
    metadata: {
        filename: string;
        pageNumber: number;
        position: number;
        charCount: number;
        byteSize: number;
    };
}

describe('PDFChunkManager', () => {
    let manager: PDFChunkManager;
    const mockChunks: ProcessedChunk[] = [
        {
            text: 'Chunk 1 content',
            metadata: {
                filename: 'test.pdf',
                pageNumber: 1,
                position: 0,
                charCount: 100,
                byteSize: 100
            }
        },
        {
            text: 'Chunk 2 content',
            metadata: {
                filename: 'test.pdf',
                pageNumber: 1,
                position: 100,
                charCount: 100,
                byteSize: 100
            }
        }
    ];

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Setup manager
        manager = new PDFChunkManager();

        // Mock path functions
        (path.dirname as jest.MockedFunction<typeof path.dirname>)
            .mockImplementation((p: string) => '/mock/dir');
        (path.join as jest.MockedFunction<typeof path.join>)
            .mockImplementation((...paths: string[]) => paths.join('/'));
        (path.parse as jest.MockedFunction<typeof path.parse>)
            .mockImplementation(() => ({
                root: '/',
                dir: '/mock/dir',
                base: 'test.pdf',
                ext: '.pdf',
                name: 'test'
            }));

        // Mock fs functions
        (fs.existsSync as jest.MockedFunction<typeof fs.existsSync>)
            .mockReturnValue(false);
        (fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>)
            .mockImplementation(() => undefined);
        (fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>)
            .mockImplementation(() => undefined);

        // Setup default mock Dirent objects for PDF files
        const mockDirents = [
            createMockDirent('test1.pdf'),
            createMockDirent('test2.pdf'),
            createMockDirent('notapdf.txt')
        ];

        // Mock readdirSync
        jest.spyOn(fs, 'readdirSync').mockReturnValue(mockDirents);

        // Mock PDFProcessor
        jest.spyOn(PDFProcessor.prototype, 'processPDF')
            .mockResolvedValue(mockChunks);
    });

    describe('processPDFToFiles', () => {
        it('should process a PDF and create chunk files', async () => {
            const result = await manager.processPDFToFiles('test.pdf');

            // Check directory creation
            expect(fs.existsSync).toHaveBeenCalledWith(expect.any(String));
            expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });

            // Check PDF processing
            expect(PDFProcessor.prototype.processPDF).toHaveBeenCalledWith(
                'test.pdf',
                expect.any(Object)
            );

            // Check file writing
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2);

            // Verify output structure
            expect(result).toEqual({
                outputPath: expect.any(String),
                chunkCount: 2,
                totalCharacters: 200,
                totalBytes: 200,
                outputFiles: expect.arrayContaining([
                    expect.stringMatching(/chunk_test_\d{3}\.txt/)
                ])
            });
        });

        it('should use custom options when provided', async () => {
            const options = {
                maxChunkSize: 2000,
                overlap: 50,
                preserveParagraphs: true,
                fixHyphenation: false,
                outputDir: 'custom/dir',
                filePrefix: 'custom'
            };

            await manager.processPDFToFiles('test.pdf', options);

            // Check if options were passed to processor
            expect(PDFProcessor.prototype.processPDF).toHaveBeenCalledWith(
                'test.pdf',
                expect.objectContaining({
                    maxChunkSize: 2000,
                    overlap: 50,
                    preserveParagraphs: true,
                    fixHyphenation: false
                })
            );

            // Check if custom output directory was used
            expect(fs.mkdirSync).toHaveBeenCalledWith('custom/dir', { recursive: true });

            // Check if custom prefix was used
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringMatching(/custom_test_\d{3}\.txt/),
                expect.any(String),
                'utf8'
            );
        });

        it('should handle errors gracefully', async () => {
            // Mock processor to throw error
            jest.spyOn(PDFProcessor.prototype, 'processPDF')
                .mockRejectedValue(new Error('Processing failed'));

            await expect(manager.processPDFToFiles('test.pdf'))
                .rejects
                .toThrow('Failed to process PDF test.pdf: Processing failed');
        });
    });

    describe('processDirectoryToFiles', () => {
        it('should process multiple PDFs in a directory', async () => {
            const result = await manager.processDirectoryToFiles('/test/dir');

            // Check if correct files were processed
            expect(PDFProcessor.prototype.processPDF).toHaveBeenCalledTimes(2);
            expect(PDFProcessor.prototype.processPDF).toHaveBeenCalledWith(
                '/test/dir/test1.pdf',
                expect.any(Object)
            );
            expect(PDFProcessor.prototype.processPDF).toHaveBeenCalledWith(
                '/test/dir/test2.pdf',
                expect.any(Object)
            );

            // Verify combined output
            expect(result).toEqual({
                outputPath: expect.any(String),
                chunkCount: 4,
                totalCharacters: 400,
                totalBytes: 400,
                outputFiles: expect.arrayContaining([
                    expect.stringMatching(/chunk_test_\d{3}\.txt/)
                ])
            });
        });

        it('should throw error when no PDFs found', async () => {
            // Override the readdirSync mock for this test only
            const nonPdfDirents = [
                createMockDirent('test1.txt'),
                createMockDirent('test2.doc'),
                createMockDirent('test3.jpg')
            ];

            jest.spyOn(fs, 'readdirSync').mockReturnValue(nonPdfDirents);

            await expect(manager.processDirectoryToFiles('/test/dir'))
                .rejects
                .toThrow('No PDF files found in directory');
        });

        it('should handle processing errors', async () => {
            jest.spyOn(PDFProcessor.prototype, 'processPDF')
                .mockRejectedValue(new Error('Processing failed'));

            await expect(manager.processDirectoryToFiles('/test/dir'))
                .rejects
                .toThrow('Failed to process PDF /test/dir/test1.pdf: Processing failed');
        });
    });

    describe('getChunks', () => {
        it('should return raw chunks without saving to files', async () => {
            const result = await manager.getChunks('test.pdf');

            expect(PDFProcessor.prototype.processPDF).toHaveBeenCalledWith(
                'test.pdf',
                expect.any(Object)
            );
            expect(result).toEqual(mockChunks);

            // Verify no files were created
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('should pass options to processor', async () => {
            const options = {
                maxChunkSize: 3000,
                overlap: 150,
                preserveParagraphs: true,
                fixHyphenation: true
            };

            await manager.getChunks('test.pdf', options);

            expect(PDFProcessor.prototype.processPDF).toHaveBeenCalledWith(
                'test.pdf',
                expect.objectContaining(options)
            );
        });
    });
}); 