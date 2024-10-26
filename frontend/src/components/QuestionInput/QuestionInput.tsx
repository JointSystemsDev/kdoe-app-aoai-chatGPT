import { useContext, useEffect, useState } from 'react'
import { FontIcon, Stack, TextField, TooltipHost } from '@fluentui/react'
import { SendRegular } from '@fluentui/react-icons'

import Send from '../../assets/Send.svg'

import styles from './QuestionInput.module.css'
import { ChatMessage } from '../../api'
import { AppStateContext } from '../../state/AppProvider'
import { resizeImage } from '../../utils/resizeImage'
import { useAppInsights } from '../../ApplicationInsightsSerive'

import { t } from '../../utils/localization'
import * as pdfjsLib from 'pdfjs-dist';

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
  const [question, setQuestion] = useState<string>('')
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const appInsights = useAppInsights();
  const appStateContext = useContext(AppStateContext)
  // const OYD_ENABLED = appStateContext?.state.frontendSettings?.oyd_enabled || false;

  const ui = appStateContext?.state.frontendSettings?.ui
  
  useEffect(() => {
    const loadWorker = async () => {
    // @ts-ignore
      const worker = await import('pdfjs-dist/build/pdf.worker.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
    };
    loadWorker();
  }, []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {

      if (file.type === 'application/pdf') {
        try {
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
                // Check if the item has 'str' property, otherwise use an empty string
                return 'str' in item ? item.str : '';
              }).join(' ')
            })
          }	
          const pdfString = pages.map(page => `Page Number: ${page.pageNumber}\n` + page.textContent).join(' ');
          setPdfContent(pdfString);
          console.log(pdfString);
        } catch (err) {
          console.error('Error:', 'Could not load PDF ' + err);
          setPdfContent(null);
        }
      }
      // Image files
      else {
        await convertToBase64(file);
      }
    };
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
    appInsights?.trackEvent({ name: `Event: SendQuestion` });
  
    if (disabled || !question.trim()) {
      return;
    }
  
    let questionContent: ChatMessage["content"];
    
    if (base64Image) {
      // Handle image content
      questionContent = [
        { type: "text", text: question }, 
        { type: "image_url", image_url: { url: base64Image } }
      ];
    } else if (pdfContent) {
      // Handle PDF content
      questionContent = [question, pdfContent];
    } else {
      // Handle regular text content
      questionContent = question;
    }
  
    if (conversationId && questionContent !== undefined) {
      onSend(questionContent, conversationId);
      setPdfContent(null);
      setBase64Image(null);
    } else {
      onSend(questionContent);
      setPdfContent(null);
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
    <Stack horizontal className={styles.questionInputContainer}>
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
            onChange={(event) => handleImageUpload(event)} // TODO change to fileupload
            accept="image/*,.pdf"
            className={styles.fileInput}
          />
          <TooltipHost content={t('Upload Image or PDF')} id='uplodbutton'>
            <label htmlFor="fileInput" className={styles.fileLabel} aria-label='Upload Image or PDF' aria-describedby='uplodbutton'>
              <FontIcon
                className={styles.fileIcon}
                iconName={'Attach'}
                aria-label='Upload Image or PDF'
                aria-describedby='uplodbutton'
              />
            </label>
          </TooltipHost>
        </div>)}
      {base64Image && <img className={styles.uploadedImage} src={base64Image} alt="Uploaded Preview" />}
      {pdfContent && (
        <TooltipHost content="PDF uploaded" id="pdfIndicator">
          <div className={styles.pdfPreview}>
            <FontIcon
              className={styles.pdfPreviewIcon}
              iconName="PDF"
              aria-label="PDF Document Ready"
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
      {ui?.limit_input_to_characters && ui?.limit_input_to_characters > 0 && (
        <div className={styles.characterCount}>
          {`${question.length}/${ui?.limit_input_to_characters}`}
        </div>
      )}
    </Stack>
  )
}
