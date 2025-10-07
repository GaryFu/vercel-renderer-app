"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Container, Form, Button, Spinner } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { toPng } from "html-to-image";
import { ResizableBox } from "react-resizable";
import axios from "axios";

const placeholder = `# AI-Powered Markdown & LaTeX Renderer

This editor can now use AI to fix your LaTeX!

## Example of a broken chemical equation
Paste this in, select it, and click "AI Optimize":
$$ 
\\left[ CH_2-CH \\right]_n + nC_2H_5OH \\xrightarrow{H^+/\\Delta} \\left[ CH_2-CH \\right]_n + nCH_3COOC_2H_5
$$
$$ \\qquad \\quad | \\qquad\\qquad\\qquad\\qquad\\qquad | $$
$$ \\qquad \\quad OOCCH_3 \\qquad\\qquad\\qquad\\qquad OH $$
`;

export default function Home() {
  const [input, setInput] = useState(placeholder);
  const [copyButtonText, setCopyButtonText] = useState("Copy as Image");
  const [isPreviewFullScreen, setIsPreviewFullScreen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [width, setWidth] = useState(250);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    if (inputRef.current) {
      inputRef.current.select();
    }
  }, []);

  const processCitations = (text: string) => {
    return text
      .replace(/\[cite\\?_start\]/g, "<sup>")
      .replace(/\[cite\\?_end\]/g, "</sup>")
      .replace(/\[cite: ([\d, ]+)\]/g, "<sup>$1</sup>");
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
      alert("Failed to paste from clipboard. Please check browser permissions.");
    }
  };

  const handleAIOptimize = async () => {
    if (!inputRef.current) return;

    const { selectionStart, selectionEnd } = inputRef.current;
    const selectedText = input.substring(selectionStart, selectionEnd);
    const isFragment = !!selectedText;
    const textToOptimize = isFragment ? selectedText : input;

    if (!textToOptimize) return;

    setIsOptimizing(true);
    try {
      const response = await axios.post('/api/optimize', { text: textToOptimize, isFragment });
      if (response.data && response.data.optimizedText) {
        const optimizedText = response.data.optimizedText;
        if (isFragment) {
          const newInput = input.substring(0, selectionStart) + optimizedText + input.substring(selectionEnd);
          setInput(newInput);
        } else {
          setInput(optimizedText);
        }
      }
    } catch (error) {
      let errorMessage = "An unknown error occurred.";
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.error || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      alert(`AI Optimization Failed: ${errorMessage}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCopyToImage = useCallback(() => {
    if (previewRef.current === null) return;
    toPng(previewRef.current, { cacheBust: true, pixelRatio: 2 })
      .then((dataUrl) => {
        const blob = dataURLtoBlob(dataUrl);
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          .then(() => {
            setCopyButtonText("Copied!");
            setTimeout(() => setCopyButtonText("Copy as Image"), 2000);
          })
          .catch(() => alert("Failed to copy image. Your browser may not support this feature."));
      })
      .catch(() => alert("Failed to convert content to image."));
  }, [previewRef]);

  function dataURLtoBlob(dataurl: string) {
    const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], {type:mime});
  }

  useEffect(() => {
    const handleResize = () => {
      if (!isPreviewFullScreen) {
        setWidth(window.innerWidth * 0.25);
      }
    };
    if (isClient) {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isPreviewFullScreen, isClient]);

  return (
    <Container fluid className="mt-4 d-flex flex-column vh-100">
      <h1 className="text-center mb-4">AI-Powered Markdown & LaTeX Renderer</h1>
      <div className="d-flex flex-grow-1">
        {isClient && !isPreviewFullScreen && (
          <ResizableBox
            width={width}
            height={Infinity}
            axis="x"
            minConstraints={[window.innerWidth * 0.1, Infinity]}
            maxConstraints={[window.innerWidth * 0.8, Infinity]}
            onResize={(e, { size }) => setWidth(size.width)}
            className="d-flex flex-column"
          >
            <Form.Group controlId="editor-input" className="d-flex flex-column flex-grow-1">
              <Form.Label className="d-flex justify-content-between align-items-center">
                <span>Input</span>
                <div>
                  <Button variant="outline-secondary" size="sm" onClick={handlePaste} className="me-2">
                    Paste
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleAIOptimize} disabled={isOptimizing}>
                    {isOptimizing ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : '✨ AI Optimize'}
                  </Button>
                </div>
              </Form.Label>
              <Form.Control
                ref={inputRef}
                as="textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-grow-1"
                style={{ resize: "none" }}
              />
            </Form.Group>
          </ResizableBox>
        )}
        <div className="d-flex flex-column flex-grow-1" style={{ width: isPreviewFullScreen ? '100%' : (isClient ? `calc(100% - ${width}px)`: '75%') }}>
          <Form.Group controlId="preview-output" className="d-flex flex-column flex-grow-1">
            <Form.Label className="d-flex justify-content-between align-items-center">
              <span>Preview</span>
              <div>
                <Button variant="outline-secondary" size="sm" onClick={() => setIsPreviewFullScreen(!isPreviewFullScreen)} className="me-2">
                  {isPreviewFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                </Button>
                <Button variant="outline-primary" size="sm" onClick={handleCopyToImage}>
                  {copyButtonText}
                </Button>
              </div>
            </Form.Label>
            <div ref={previewRef} className="preview-pane p-3 border rounded flex-grow-1 overflow-auto">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
              >
                {processCitations(input)}
              </ReactMarkdown>
            </div>
          </Form.Group>
        </div>
      </div>
      <style jsx global>{`
        .preview-pane { background-color: #f8f9fa; line-height: 1.8; }
        .preview-pane ol, .preview-pane ul { padding-left: 2rem; }
        .preview-pane li { margin-bottom: 0.5rem; }
        sup { line-height: 0; position: relative; vertical-align: baseline; top: -0.5em; font-size: 75%; }
        .react-resizable-handle { background: #ddd; }
      `}</style>
    </Container>
  );
}
