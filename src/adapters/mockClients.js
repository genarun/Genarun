// adapters/mockClients.js

function generateMockText(type, count = 1) {
  const templates = [
    "A series exploring ${topic} in ${location}",
    "The impact of ${event} on ${subject}",
    "Life through the lens of ${perspective}",
  ];

  if (count > 1) {
    return Array(count)
      .fill()
      .map(() =>
        templates[Math.floor(Math.random() * templates.length)]
          .replace(
            "${topic}",
            ["climate", "culture", "technology"][Math.floor(Math.random() * 3)]
          )
          .replace(
            "${location}",
            ["urban spaces", "remote villages", "coastal areas"][
              Math.floor(Math.random() * 3)
            ]
          )
      );
  }

  return templates[0]
    .replace("${topic}", "daily life")
    .replace("${location}", "modern cities");
}

function generateMockProjectDetails() {
  return {
    description: "A compelling photographic exploration of urban life",
    title: "City Shadows",
    slug: "city-shadows",
    photographerName: "Alex Rivera",
    photographerBio: "Award-winning documentary photographer",
    photographerPortraitPhotoDescription:
      "Professional headshot in natural light",
  };
}

export class MockOpenAIClient {
  async chat({ messages }) {
    const lastMessage = messages[messages.length - 1].content;

    // Generate initial ideas array
    if (lastMessage.includes(" best ideas as")) {
      return [
        "Urban solitude through reflections",
        "Climate change impact on communities",
        "Daily life in modern cities",
        "Cultural diversity in urban spaces",
        "Technology and social interactions",

        "Urban solitude through reflections",
        "Climate change impact on communities",
        "Daily life in modern cities",
        "Cultural diversity in urban spaces",
        "Technology and social interactions",
      ];
    }

    // Generate project details
    if (lastMessage.includes("comprehensive summary")) {
      return {
        description: "A powerful visual narrative exploring urban isolation",
        title: "City Reflections",
        slug: "city-reflections",
        photographerName: "Alex Rivera",
        photographerBio: "Documentary photographer focused on urban stories",
        photographerPortraitPhotoDescription:
          "Black and white portrait against urban backdrop",
      };
    }

    // Generate visual descriptions
    if (lastMessage.includes("key visual scenes")) {
      return [
        "A woman's reflection in a rain-covered window",
        "Empty subway platform at dawn",
        "Solitary figure in crowded plaza",
        "Lights reflecting in puddles at night",
        "Shadow patterns on concrete walls",
      ];
    }

    return "Mock response";
  }
}

export class MockReplicateClient {
  async generate(prompt) {
    return `https://mock-image-url.com/${Date.now()}.jpg?prompt=${prompt}`;
  }
}
