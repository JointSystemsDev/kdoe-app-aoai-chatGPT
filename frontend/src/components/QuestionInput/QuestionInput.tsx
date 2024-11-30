import { useContext, useEffect, useState } from 'react'
import { FontIcon, Stack, TextField, TooltipHost } from '@fluentui/react'
import { SendRegular } from '@fluentui/react-icons'
import mammoth from 'mammoth'

import Send from '../../assets/Send.svg'

import styles from './QuestionInput.module.css'
import { ChatMessage, TextContent, DocumentContent, ImageUrlContent } from '../../api'
import { AppStateContext } from '../../state/AppProvider'
import { resizeImage } from '../../utils/resizeImage'

import { t } from '../../utils/localization'
import * as pdfjsLib from 'pdfjs-dist';
import uuid from 'react-uuid'

interface Props {
  onSend: (question: ChatMessage['content'], id?: string) => void
  disabled: boolean
  placeholder?: string
  clearOnSend?: boolean
  conversationId?: string
}

type PageContents = {
  pageNumber: number;
  textContent: string;
}

export const QuestionInput = ({ onSend, disabled, placeholder, clearOnSend, conversationId }: Props) => {
  const [question, setQuestion] = useState<string>('');
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<DocumentContent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const appStateContext = useContext(AppStateContext);
  const ui = appStateContext?.state.frontendSettings?.ui;

  
  useEffect(() => {
    const loadWorker = async () => {
      // @ts-ignore
      const worker = await import('pdfjs-dist/build/pdf.worker.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
    };
    loadWorker();
  }, []);

  const validateDocumentText = (text: string): boolean => {
    // Count only alphanumeric characters
    const alphaNumericCount = (text.match(/[a-zA-Z]/g) || []).length;
    return alphaNumericCount >= 100;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (file) {
      // Clear any existing error
      setErrorMessage(null);
      
      try {
        if (file.type === 'application/pdf') {
          await handlePdfUpload(file);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          await handleDocxUpload(file);
        } else if (file.type.startsWith('image/')) {
          await convertToBase64(file);
        }
      } catch (error) {
        // Set error message to be displayed
        setErrorMessage(error instanceof Error ? error.message : 'Error processing document');
        // Clear any uploaded content
        setDocumentContent(null);
        setBase64Image(null);
      }
    }
  };

  const handlePdfUpload = async (file: File) => {
     const arrayBuffer = await file.arrayBuffer();
     const loadingTask = pdfjsLib.getDocument(arrayBuffer);
     const pdf = await loadingTask.promise;
     const numPages = pdf.numPages;
     const pages: PageContents[] = [];
     
     for (let i = 1; i <= numPages; i++) {
       const page = await pdf.getPage(i);
       const textContent = await page.getTextContent();
       pages.push({
         pageNumber: i,
         textContent: textContent.items.map(item => {
           return 'str' in item ? item.str : '';
         }).join(' ')
       });
     }	

     const pdfString = pages.map(page => 
       // `Page Number: ${page.pageNumber}\n${page.textContent}`
       `\n${page.textContent}`
     ).join('\n');

     if (!validateDocumentText(pdfString)) {
       throw new Error(t('The uploaded PDF does not contain enough readable text. The document might be scanned or the text might not be machine-readable.'));
     }

     setDocumentContent({
       type: 'document',
       documentType: 'pdf',
       content: pdfString
     });
  }

  const handleDocxUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (!validateDocumentText(result.value)) {
      throw new Error(t('The uploaded Word document does not contain enough readable text.'));
    }

    setDocumentContent({
      type: 'document',
      documentType: 'docx',
      content: result.value
    });
  }

  const convertToBase64 = async (file: Blob) => {
    try {
      const resizedBase64 = await resizeImage(file, 800, 800);
      setBase64Image(resizedBase64);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const sendQuestion = () => {
    if (disabled || !question.trim()) {
      return;
    }

    const textContent: TextContent = {
      type: "text",
      text: question
    };
  
    let questionContent: ChatMessage["content"];
    
    if (base64Image) {
      const imageContent: ImageUrlContent = {
        type: "image_url",
        image_url: { url: base64Image }
      };
      questionContent = [textContent, imageContent];
    } else if (documentContent) {
      questionContent = [textContent, documentContent];
    } else {
      questionContent = question;
    }
  
    if (conversationId && questionContent !== undefined) {
      onSend(questionContent, conversationId);
      setDocumentContent(null);
      setBase64Image(null);
    } else {
      onSend(questionContent);
      setDocumentContent(null);
      setBase64Image(null);
    }
  
    if (clearOnSend) {
      setQuestion('');
    }
  }

  const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
    if (ev.key === 'Enter' && !ev.shiftKey && !(ev.nativeEvent?.isComposing === true)) {
      ev.preventDefault()
      sendQuestion()
    }
  }

  const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    if (ui?.limit_input_to_characters && ui?.limit_input_to_characters > 0 && newValue && newValue.length <= ui?.limit_input_to_characters) {
        setQuestion(newValue);
    }
    if (!newValue)
    {
        setQuestion("");
    }
  };

  const sendQuestionDisabled = disabled || !question.trim()

  return (
    <Stack horizontal className={`${styles.questionInputContainer} ${errorMessage ? styles.hasError : ''}`}>
      <TextField
        className={styles.questionInputTextArea}
        placeholder={placeholder}
        multiline
        resizable={false}
        borderless
        value={question}
        onChange={onQuestionChange}
        onKeyDown={onEnterPress}
      />
      {ui?.enable_image_chat && (
        <div className={styles.fileInputContainer}>
          <input
            type="file"
            id="fileInput"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.docx"
            className={styles.fileInput}
          />
          <TooltipHost content={t('Upload Image, PDF, or Word Document')} id='uploadbutton'>
            <label htmlFor="fileInput" className={styles.fileLabel}>
              <FontIcon
                className={styles.fileIcon}
                iconName={'Attach'}
              />
            </label>
          </TooltipHost>
        </div>
      )}
      {base64Image && <img className={styles.uploadedImage} src={base64Image} alt="Uploaded Preview" />}
      {documentContent && (
        <TooltipHost 
          content={`${documentContent.documentType.toUpperCase()} uploaded`} 
          id="documentIndicator"
        >
          <div className={styles.documentPreview}>
            <FontIcon
              className={styles.documentIcon}
              iconName={documentContent.documentType === 'pdf' ? "PDF" : "WordDocument"}
              style={{
                color: documentContent.documentType === 'pdf' ? '#d83b01' : '#2b579a'
              }}
              aria-label={`${documentContent.documentType.toUpperCase()} Document Ready`}
            />
          </div>
        </TooltipHost>
      )}
      <div
        className={styles.questionInputSendButtonContainer}
        role="button"
        tabIndex={0}
        aria-label="Ask question button"
        onClick={sendQuestion}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? sendQuestion() : null)}>
        {sendQuestionDisabled ? (
          <SendRegular className={styles.questionInputSendButtonDisabled} />
        ) : (
          <img src={Send} className={styles.questionInputSendButton} alt="Send Button" />
        )}
      </div>
      <div className={styles.questionInputBottomBorder} />
      {errorMessage && (
        <div className={styles.errorMessage} role="alert">
          {errorMessage}
        </div>
      )}
      {ui?.limit_input_to_characters && ui?.limit_input_to_characters > 0 && (
        <div className={styles.characterCount}>
          {`${question.length}/${ui?.limit_input_to_characters}`}
        </div>
      )}
    </Stack>
  );
}