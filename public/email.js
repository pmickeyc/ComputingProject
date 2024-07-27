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

    document.getElementById('exit-portal').addEventListener('click', function () {
        goBack();
        
    });



    // Levels (the index) of real to fake emails 
    const levelRatios = [{
            real: 9,
            fake: 1
        },
        {
            real: 8,
            fake: 2
        },
        {
            real: 7,
            fake: 3
        },
        {
            real: 6,
            fake: 4
        },
        {
            real: 5,
            fake: 5
        },
        {
            real: 5,
            fake: 5
        },
        {
            real: 4,
            fake: 6
        },
        {
            real: 7,
            fake: 3
        },
        {
            real: 1,
            fake: 9
        },
        {
            real: 5,
            fake: 5
        }
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
        //.log(`Max real emails: ${maxRealEmails}, Max fake emails: ${maxFakeEmails}`);
    }


    let userLevel = Math.floor(Math.random() * 10) + 1; // This will give a random number between 1 and 100
 // You can change this to the user's actual level
    calculateEmailLimits(userLevel);

    // Function to add event listener to an email item
    function addEmailClickListener(emailItem) {
        emailItem.addEventListener('click', function () {
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
            <button class="guess-fake btn btn-warning">Fake</button>
            <button class="guess-real btn btn-success">Real</button>
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
            submitGuess(emailId, 'fake');
        });

        btnReal.addEventListener('click', function (event) {
            event.stopPropagation();
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

            //console.log(`Correct guesses: ${correctGuesses}, Incorrect guesses: ${incorrectGuesses}, Total guesses: ${totalGuesses}`);

            // Disable the guess buttons for this email item
            const btnFake = emailElement.querySelector('.guess-fake');
            const btnReal = emailElement.querySelector('.guess-real');
            btnFake.disabled = true;
            btnReal.disabled = true;

            // If the user has made 5 guesses, display the score
            if (totalGuesses === maxGuesses) {
                //console.log('Reached max guesses');
                showScoreModal();
                correctGuesses = 0;
                incorrectGuesses = 0;
                totalGuesses = 0;
            }
        } else {
            console.error('Email element not found:', emailId);
        }
    }

    function shuffleArray(array) {
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
                document.querySelector('.email-list').prepend(emailToDeliver);
                deliveryCount++;
                //console.log(`Delivered email count: ${deliveryCount}`);
            } else {
                clearInterval(emailDeliveryInterval); // Stop the interval after maxEmailsDelivered emails
            }
        }, 1500); // time interval setting
    }

    async function fetchEmails(id) {
        try {
            const response = await fetch(`/emails/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            let emailData = await response.json();
            // Sort and count fake and real emails from the fetched data
            emailData.forEach(email => {
                if (email.fake === true && fakeEmailCount < maxFakeEmails) {
                    deliveredEmails.push(createEmail(email));
                    fakeEmailCount++;
                } else if (email.fake === false && realEmailCount < maxRealEmails) {
                    deliveredEmails.push(createEmail(email));
                    realEmailCount++;
                }
            });

            //console.log(`Fetched emails - Fake: ${fakeEmailCount}, Real: ${realEmailCount}`);
            // Shuffle the emails to randomize the order of delivery
            shuffleArray(deliveredEmails);

            // Start the email delivery process
            startEmailDelivery();
        } catch (error) {
            console.error('Error fetching emails:', error);
        }
    }

    // Extract the collection ID from the URL path and fetch emails
    const pathParts = window.location.pathname.split('/');
    const collectionId = pathParts[pathParts.length - 1];
    const [courseId, contentId] = collectionId.split('_');
    // Ensure courseId and contentId are available and collectionId is valid
    if (courseId && contentId && collectionId) {
        //console.log(`Fetching emails for course ID: ${courseId}, content ID: ${contentId}`);
        fetchEmails(collectionId);
    } else {
        console.error('No valid course ID, content ID, or collection ID found in the URL path');
    }


    // Function to show the full email content
    function showEmailContent(emailContentHTML) {
        const emailFullView = document.querySelector('.email-full');
        const emailListView = document.querySelector('.email-list');
        const emailContentWithoutButtons = emailContentHTML.replace(/<div class="email-guess-buttons">[\s\S]*?<\/div>/, '');
        emailFullView.innerHTML = emailContentWithoutButtons;
        emailFullView.style.display = 'block';
        emailListView.style.display = 'none';
    }

    // Function to add event listener to an email item
    function addEmailClickListener(emailItem) {
        emailItem.addEventListener('click', function (event) {
            if (event.target === emailItem || event.target.className === 'email-snippet') {
                const emailContentHTML = this.innerHTML;
                showEmailContent(emailContentHTML);
            }
        });
    }

    // Event listener for the Inbox title click, using the ID
    document.querySelector('#inbox-title').addEventListener('click', function () {
        const emailFullView = document.querySelector('.email-full');
        const emailListView = document.querySelector('.email-list');
        emailFullView.style.display = 'none';
        emailListView.style.display = 'block';
    });

    

    // Timer code
    let timeLeft = 120; // Time in seconds
    const timerElement = document.getElementById('timer');

    function updateTimer() {
        let minutes = Math.floor(timeLeft / 60);
        let seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(timerInterval);
            if (confirm('Time is up! The game has ended. Do you want to proceed (which will reload the page) or go back? \n\nClick OK to reload the page or Cancel to exit the portal.')) {
                location.reload();
            } else {
                goBack();
            }
        }
    }

    let timerInterval = setInterval(updateTimer, 1000);

    window.goBack = function () {
        window.history.back();
    };

    // Start the timer as soon as the DOM loads
    updateTimer();

    function showScoreModal() {
        //console.log('Showing score modal');
        clearInterval(timerInterval); // Stop the timer when the modal appears
        const modal = document.getElementById('scoreModal');
        const modalMessage = document.getElementById('modalMessage');
        const perfectScoreOptions = document.getElementById('perfectScoreOptions');
        const normalScoreOptions = document.getElementById('normalScoreOptions');

        const perfectScore = incorrectGuesses === 0;
        modalMessage.textContent = perfectScore ? 'Perfect score! You got all correct.' : `Your score: ${correctGuesses} correct, ${incorrectGuesses} incorrect.`;

        if (perfectScore) {
            perfectScoreOptions.style.display = 'block';
            normalScoreOptions.style.display = 'none';
        } else {
            perfectScoreOptions.style.display = 'none';
            normalScoreOptions.style.display = 'block';
        }

        $(modal).modal('show');
    }

    $('#markCompleteBtn').on('click', function () {
        markContentComplete(contentId, courseId);
    });

    $('#reloadBtn').on('click', function () {
        location.reload();
    });

    $('#exitBtn').on('click', function () {
        goBack();
    });
    function markContentComplete(contentId, courseId) {
        fetch('/csrf-token')
            .then(response => response.json())
            .then(data => {
                console.log(data);
                const csrfToken = data.csrfToken; // Set the CSRF token value
    
                $.ajax({
                    url: `/api/complete-content/${contentId}`,
                    method: 'POST',
                    headers: {
                        'CSRF-Token': csrfToken // Include CSRF token in the headers
                    },
                    data: JSON.stringify({ courseId: courseId }), // Convert data to JSON string
                    contentType: 'application/json', // Set content type to application/json
                    success: function (data) {
                        console.log('Content marked as complete:', data); // Log success response
                        goBack(); // Refresh the page
                    },
                    error: function (xhr, status, error) {
                        console.error("Failed to mark content as complete:", status, error);
                        alert('Failed to mark content as complete.');
                    }
                });
            })
            .catch(error => {
                console.error('Failed to fetch CSRF token', error);
            });
    }
    
});