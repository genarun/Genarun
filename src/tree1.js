export const myTree = {
  id: "year",
  //  outputKey: "editionData",
  type: "object", //big one!
  requiredInputs: ["year"],

  generations: [
    {
      id: "ideas",
      type: "text-array",
      outputKey: "themes",

      config: {
        prompt: [
          {
            template:
              "Generate 40 new worthy important news events and topics ideas for ${year}, focusing on visual appeal and exhibition potential.",
          },
          {
            parseJson: true, // This message will return JSON
            template:
              "Select and output the 3 best ideas as a JSON array of detailed strings. Return a JSON array of 5 strings in this format: {data: ['string1', 'string2', 'string3'...]}.",
            /*
              system:
              'Return a JSON array like ["A photography series exploring urban solitude through reflections in city windows", ...]',
              */
          },
        ],
        model: {
          name: "text",
          temperature: 0.8,
        },
      },
      validation: {
        minLength: 3,
        maxLength: 20,
        required: true,
      },
      generations: [
        {
          id: "series",
          type: "object",
          requiredInputs: ["i"],
          outputKey: "texts",
          config: {
            prompt: [
              {
                //   parseJson: true,
                template: " for this subject: ${i}",
                system:
                  "Write 3 different way we could approach a coverage of this topic as a  story photojournalism award winning project, and add a rating on 10 for originality, relevance, and visual appeal.",
              },
              {
                //  parseJson: true,
                template:
                  " which of these ideas would work best for a world press photo award winning project, and what would be quality (and original) title ideas for it?",
              },
              {
                parseJson: true, // This message will return JSON
                template: `ok. Create a comprehensive summary for this photography project in JSON, use the best title idea, and add a kebab-case slug, start with description.
                
                {
  "description": "A documentary exploration of urban beekeepers maintaining rooftop apiaries across New York City. 100 more words....",
  "title": "Rooftop Honey: Urban Beekeepers of NYC",
  "slug": "rooftop-honey-urban-beekeepers-nyc",
  "photographerName": "Elena Martinez",
  "photographerBio": "Elena Martinez is a documentary photographer specializing in environmental storytelling. With a background in biology, she bridges the gap between science communication and artistic expression through her lens. 100 more words...",
  "photographerPortraitPhotoDescription": "Black and white portrait of Elena in her signature denim jacket, standing against a blurred cityscape with golden hour lighting, holding her trusted Hasselblad camera"
}
  
`,

                //      system:  "Return a JSON object with: description (100-500 words), title (5-100 chars), photographerName (fictive person name) (string), photographerBio (string), photographerPortraitPhotoDescription(string),  and kebab-case slug",
              },
            ],
            validation: {
              required: [
                "description",
                "title",
                "slug",
                "photographerName",
                "photographerBio",
                "photographerPortraitPhotoDescription",
              ],
            },
          },
          generations: [
            {
              id: "photogPortraitUrl",
              type: "image",

              requiredInputs: ["photographerPortraitPhotoDescription"],
              // outputKey: "images",
              //  count: 1,
              config: {
                prompt: {
                  prefix:
                    "Profesional portrait or the award winniing photographer :{photographerName}",
                  template: "${photographerPortraitPhotoDescription}",
                  suffix: "in the style of fine art photography",
                },
                model: {
                  name: "image",
                  quality: "hd",
                },
              },
            },
            {
              id: "photos",
              type: "text-array",
              parallel: true,
              requiredInputs: ["description"],
              outputKey: "visualDescriptions",
              config: {
                prompt: [
                  {
                    parseJson: true, // This message will return JSON
                    template:
                      "Return a JSON array of 5 strings in this format: {data: ['string1', 'string2', 'string3'...]}. The strings are visual descriptions: Analyze and describe 5 random visual scenes or moments from a random award wining photography project -- ${description}",

                    /*
                      system:
                      "Return a JSON array format of 5 detailed visual descriptions",
                      */
                  },
                ],
              },
              validation: {
                minLength: 5,
                required: true,
              },
              generations: [
                {
                  id: "imageUrls",
                  type: "image",
                  requiredInputs: ["i"], //for loops
                  // outputKey: "images",
                  // count: 3,
                  config: {
                    prompt: {
                      prefix: "Artistic interpretation of:",
                      template: "${i}",
                      suffix: "in the style of fine art photography",
                    },
                    model: {
                      name: "image",
                      quality: "hd",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const projectConfig = {
  baseDir: "2024",
  outputFormats: ["md", "json"],
  maxRetries: 3,
  timeout: 30000,
  models: {
    text: {
      endpoint: "gpt-4",
      defaultParams: {
        temperature: 0.7,
        maxTokens: 2000,
      },
    },
    image: {
      endpoint: "dall-e-3",
      defaultParams: {
        quality: "standard",
        size: "1024x1024",
      },
    },
  },
  generations: [myTree],
};
