import { renderSpeechRecognitionTester } from './components/SpeechRecognitionTester.js';

const applicationRootElement = document.getElementById('app');

if (applicationRootElement) {
  renderSpeechRecognitionTester(applicationRootElement);
}
