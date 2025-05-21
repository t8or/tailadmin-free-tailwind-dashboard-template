import fetch from 'node-fetch';

class OllamaService {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generateResponse(prompt, model = 'mixtral') {
    try {
      console.log('Sending request to Ollama service...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 120 second timeout

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            prompt: `${prompt}\n\nYou are a helpful assistant that extracts structured data from text. The provided text is from a PDF report on a property. Look for key value pairs and tables. Convert the basic text into a JSON output. Focus on accuracy and maintaining the original data structure. If you encounter any unclear or ambiguous data, mark it as null rather than making assumptions.`,
            stream: false,
            options: {
              temperature: 0.01, // Reduced temperature for more consistent output
              num_predict: 30000
            }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Received response from Ollama service');
      const data = await response.json();
      return data.response.trim();

    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Request timed out after 120 seconds');
        throw new Error('Request to Ollama service timed out');
      }
      console.error('Error in generateResponse:', error);
      throw error;
    }
  }

  async analyzePropertyData({ text, section, tables, page_number }, type) {
    try {
      // Break down text into sections if it's too long
      const sections = text.split('\n\n');
      const maxSectionLength = 5000;
      let processedSections = [];
      
      console.log('Processing text in sections...');
      
      for (let i = 0; i < sections.length; i += 3) {
        const sectionChunk = sections.slice(i, i + 3).join('\n\n');
        if (sectionChunk.length > maxSectionLength) {
          console.log('Section too large, splitting further...');
          continue;
        }
        
        const prompt = `Extract structured data from the following text section:\n\n${sectionChunk}\n\nProvide the response in valid JSON format. Do not escape underscores or special characters in property names. Format the response as a single JSON object with nested properties.`;
        
        const response = await this.generateResponse(prompt);
        console.log(`Processed section ${i + 1} of ${sections.length}`);
        
        try {
          const parsed = JSON.parse(response);
          processedSections.push(parsed);
        } catch (parseError) {
          console.error(`Error parsing section ${i + 1}:`, parseError);
          continue;
        }
      }
      
      // Combine all processed sections
      const combinedData = processedSections.reduce((acc, curr) => {
        return { ...acc, ...curr };
      }, {});
      
      return {
        structured_data: [combinedData],
        metadata: {
          section,
          page_number,
          type
        }
      };
    } catch (error) {
      console.error('Error analyzing property data:', error);
      throw error;
    }
  }
}

export { OllamaService }; 