/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform


TODO:
Refine this functinoality and link to the coursecontent table in the MSSQL DB
*/


document.addEventListener('DOMContentLoaded', function () {
    let deliveredEmails = []; // Array to store emails to be delivered
    let fakeEmailCount = 0;
    let realEmailCount = 0;
    let deliveryCount = 0; // Counter for delivered emails
    let correctGuesses = 0;
    let incorrectGuesses = 0;
    let totalGuesses = 0;
    const maxGuesses = 5;
    let maxFakeEmails = 0;
    let maxRealEmails = 0;
    let maxEmailsDelivered = 10;

    // Levels (the index) of real to fake emails 
    const levelRatios = [
        { real: 9, fake: 1 },
        { real: 8, fake: 2 },
        { real: 7, fake: 3 },
        { real: 6, fake: 4 },
        { real: 5, fake: 5 },
        { real: 5, fake: 5 },
        { real: 4, fake: 6 },
        { real: 7, fake: 3 },
        { real: 1, fake: 9 },
        { real: 5, fake: 5 }
    ];

    function calculateEmailLimits(userLevel) {
        if (userLevel >= 1 && userLevel <= 10) {
            maxRealEmails = levelRatios[userLevel - 1].real;
            maxFakeEmails = levelRatios[userLevel - 1].fake;
        } else {
            // Default values 
            maxRealEmails = 2;
            maxFakeEmails = 3;
        }
    }

    // Example usage ie.HardCoded (will read from DB for this):
    let userLevel = 3; // You can change this to the user's actual level
    calculateEmailLimits(userLevel);

    // Function to add event listener to an email item
    function addEmailClickListener(emailItem) {
        emailItem.addEventListener('click', function () {
            //console.log('Email clicked:', this.dataset.id); // Log the email ID
            document.querySelector('.email-list').innerHTML = `<div class="email-full">${this.querySelector('.email-snippet').innerHTML}</div>`;
        });
    }

    // Function to create and return a new email element
    function createEmail(emailContent) {
        let newEmail = document.createElement('div');
        newEmail.className = 'email-item';
        newEmail.dataset.id = emailContent._id; // Set the data-id attribute
        newEmail.dataset.fake = emailContent.fake;
        newEmail.innerHTML = `
        <div class="email-sender">${emailContent.sender}</div>
        <div class="email-subject">${emailContent.subject}</div>
        <div class="email-snippet">${emailContent.snippet}</div>
        <div class="email-guess-buttons">
            <button class="guess-fake">Fake</button>
            <button class="guess-real">Real</button>
        </div>
    `;
        addEmailClickListener(newEmail);
        addGuessingListeners(newEmail, emailContent._id); 
        return newEmail;
    }

    // Function to add guessing listeners to the email item
    function addGuessingListeners(emailItem, emailId) {
        const btnFake = emailItem.querySelector('.guess-fake');
        const btnReal = emailItem.querySelector('.guess-real');

        // Using a closure to ensure the correct emailId is used
        btnFake.addEventListener('click', function (event) {
            event.stopPropagation();
            //console.log('Fake guess clicked for email:', emailId); // Log the email ID
            submitGuess(emailId, 'fake');
        });

        btnReal.addEventListener('click', function (event) {
            event.stopPropagation();
            //console.log('Real guess clicked for email:', emailId); // Log the email ID
            submitGuess(emailId, 'real');
        });
    }

    function submitGuess(emailId, guess) {
        const emailElement = document.querySelector(`.email-item[data-id="${emailId}"]`);
        if (emailElement) {
            const actualFake = emailElement.dataset.fake === 'true';
            const userGuessIsFake = guess === 'fake';
            const isCorrectGuess = userGuessIsFake === actualFake;

            // Increment guess counts and display feedback
            if (isCorrectGuess) {
                correctGuesses++;
            } else {
                incorrectGuesses++;
            }
            totalGuesses++;

            // Disable the guess buttons for this email item
            const btnFake = emailElement.querySelector('.guess-fake');
            const btnReal = emailElement.querySelector('.guess-real');
            btnFake.disabled = true;
            btnReal.disabled = true;

            // If the user has made 5 guesses, display the score
            if (totalGuesses === maxGuesses) {
                alert(`Your score: ${correctGuesses} correct, ${incorrectGuesses} incorrect.`);
                correctGuesses = 0;
                incorrectGuesses = 0;
                totalGuesses = 0;
            }
        } else {
            console.error('Email element not found:', emailId);
        }
    }

    function shuffleArray(array) {
        //console.log(array)
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
    }

    // Function to deliver emails at intervals
    function startEmailDelivery() {
        let emailDeliveryInterval = setInterval(function () {
            if (deliveredEmails.length > 0 && deliveryCount < maxEmailsDelivered) {
                let emailToDeliver = deliveredEmails.shift(); // Get the next email to deliver
                //console.log('Delivering email:', emailToDeliver.dataset.id); // Log the email ID
                document.querySelector('.email-list').prepend(emailToDeliver);
                deliveryCount++;
            } else {
                clearInterval(emailDeliveryInterval); // Stop the interval after 5 emails
            }
        }, 500); // time interval setting
    }

    async function fetchEmails() {
        try {
            const response = await fetch('/emails');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            let emailData = await response.json();
            // Sort and count fake and real emails from the fetched data
            emailData.forEach(email => {
                //console.log(email.fake + " - " + fakeEmailCount +" - "+ maxFakeEmails)
                if (email.fake === true && fakeEmailCount < maxFakeEmails) {
                    deliveredEmails.push(createEmail(email));
                    fakeEmailCount++;
                } else if (email.fake === false && realEmailCount < maxRealEmails) {
                    deliveredEmails.push(createEmail(email));
                    realEmailCount++;
                }
                
            });

            //console.log(deliveredEmails)
            // Shuffle the emails to randomize the order of delivery
            shuffleArray(deliveredEmails);

            // Start the email delivery process
            startEmailDelivery();
        } catch (error) {
            console.error('Error fetching emails:', error);
        }
    }

    // Fetch emails immediately and set them up for delivery
    fetchEmails();

    // Function to show the full email content
    function showEmailContent(emailContentHTML) {
        // Reference the email full view and email list containers
        const emailFullView = document.querySelector('.email-full');
        const emailListView = document.querySelector('.email-list');

        // Remove the guess buttons from the email content HTML
        const emailContentWithoutButtons = emailContentHTML.replace(/<div class="email-guess-buttons">[\s\S]*?<\/div>/, '');

        // Set the full email content without the buttons and display it
        emailFullView.innerHTML = emailContentWithoutButtons;
        emailFullView.style.display = 'block';

        // Hide the email list
        emailListView.style.display = 'none';
    }

    // Function to add event listener to an email item
    function addEmailClickListener(emailItem) {
        emailItem.addEventListener('click', function (event) {
            // Ensure this runs only for clicks directly on the email item
            if (event.target === emailItem || event.target.className === 'email-snippet') {
                const emailContentHTML = this.innerHTML;
                showEmailContent(emailContentHTML);
            }
        });
    }

    // Event listener for the Inbox title click, using the ID
    document.querySelector('#inbox-title').addEventListener('click', function () {
        // Reference the email full view and email list containers
        const emailFullView = document.querySelector('.email-full');
        const emailListView = document.querySelector('.email-list');

        // Hide the full email view and show the email list again
        emailFullView.style.display = 'none';
        emailListView.style.display = 'block';
    });

});
