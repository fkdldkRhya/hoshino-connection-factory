import { FIGLET_FONT_DATA } from './figlet-font.data';

export async function WelcomeMessageService(): Promise<void> {
  const figlet = require('figlet');
  figlet.parseFont('custom-font', FIGLET_FONT_DATA);
  const figletText = await figlet.textSync('HoshinoCF', {
    font: 'custom-font',
    width: 80,
    horizontalLayout: 'default',
    verticalLayout: 'default',
    whitespaceBreak: true,
  });

  console.log(figletText);

  // 0.5초 대기
  await new Promise((resolve) => setTimeout(resolve, 500));
}
