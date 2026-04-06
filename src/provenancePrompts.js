const prompts = {
    default: {
      origin: [
        "How did you acquire this?",
        "When and where did you get it?",
        "Who did it come from?",
        "Was it a gift or purchase?"
      ],
      history: [
        "How long have you owned it?",
        "Has it been repaired or restored?",
        "Where has it traveled with you?",
        "Has ownership changed hands before?"
      ],
      meaning: [
        "Why does this matter to you?",
        "What memory does it carry?",
        "Who does it remind you of?",
        "What would be lost if it were gone?"
      ],
      legacy: [
        "Who should receive this?",
        "What should they know about it?",
        "Any conditions on receiving it?",
        "What story should be passed on?"
      ]
    },
  
    watch: {
      origin: [
        "Who gave you this watch?",
        "What occasion prompted the purchase?",
        "Where was it bought — city, country, store?",
        "Was it new or vintage when acquired?"
      ],
      history: [
        "Has it been serviced? By whom?",
        "Has it been worn daily or kept for occasions?",
        "Has it ever been repaired or restored?",
        "Has the band or crystal been replaced?"
      ],
      meaning: [
        "What does wearing it feel like?",
        "Does it mark a milestone or achievement?",
        "Who do you think of when you wear it?",
        "Why a watch over any other object?"
      ],
      legacy: [
        "Who should wear this after you?",
        "Should it be worn or kept safe?",
        "What should the recipient know about its care?",
        "Is there a tradition it represents?"
      ]
    },
  
    vehicle: {
      origin: [
        "When and where was it purchased?",
        "New or pre-owned when acquired?",
        "Who did you buy it from?",
        "Why this make and model?"
      ],
      history: [
        "How many miles has it covered?",
        "Any significant modifications or restorations?",
        "Where has it taken you?",
        "Any memorable road trips or events?"
      ],
      meaning: [
        "What does this vehicle represent to you?",
        "Freedom, craft, nostalgia — what is it?",
        "Who shared this vehicle with you?",
        "What's your favorite memory in it?"
      ],
      legacy: [
        "Who should own this next?",
        "Should it be driven or preserved?",
        "What maintenance should the next owner know?",
        "Is there a story they must be told?"
      ]
    },
  
    jewelry: {
      origin: [
        "Who gave this to you, or why did you buy it?",
        "What occasion does it mark?",
        "Where was it made or purchased?",
        "Is it an heirloom piece?"
      ],
      history: [
        "Has it been resized, repaired, or reset?",
        "How often is it worn?",
        "Has it passed through other hands before yours?",
        "Has it ever been appraised?"
      ],
      meaning: [
        "What does wearing it mean to you?",
        "Does it represent a relationship or milestone?",
        "Who gave it to you and what did they say?",
        "What emotion does it carry?"
      ],
      legacy: [
        "Who should receive this?",
        "Should it be worn or preserved?",
        "Is there a tradition it should continue?",
        "What should the recipient know about its origin?"
      ]
    },
  
    art: {
      origin: [
        "Where and when was it acquired?",
        "Did you meet the artist?",
        "Was it commissioned or purchased?",
        "What drew you to this piece?"
      ],
      history: [
        "Has it been restored or reframed?",
        "Where has it hung or been displayed?",
        "Has it been appraised or exhibited?",
        "Has its meaning changed over time?"
      ],
      meaning: [
        "What do you see when you look at it?",
        "Why this piece over any other?",
        "Does it represent something personal?",
        "What would a room feel like without it?"
      ],
      legacy: [
        "Where should it live next?",
        "Who would appreciate it most?",
        "Should it stay in the family or go to an institution?",
        "What should the next owner know about it?"
      ]
    },
  
    furniture: {
      origin: [
        "Where did this piece come from?",
        "Was it made, bought, or inherited?",
        "How old is it?",
        "Who made or owned it before you?"
      ],
      history: [
        "Has it been refinished or repaired?",
        "What rooms has it lived in?",
        "Has it moved with you over the years?",
        "Any notable events that took place around it?"
      ],
      meaning: [
        "What memories live in this piece?",
        "Who sat here, worked here, gathered here?",
        "Why has it stayed with you?",
        "What does it say about your home?"
      ],
      legacy: [
        "Who should have this?",
        "Should it be used or preserved?",
        "Does it belong with a specific part of the family?",
        "What story should travel with it?"
      ]
    }
  }
  
  export const getPrompts = (category, section) => {
    const key = category?.toLowerCase().trim()
    const categoryPrompts = prompts[key] || prompts.default
    return categoryPrompts[section] || prompts.default[section]
  }
  
  export default prompts