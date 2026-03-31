Create Database IF NOT EXISTS gameDB;
Use gameDB;

Create Table users (
user_id VARCHAR(10) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    user_email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    gender VARCHAR(20) NOT NULL
);
Select*From users;

CREATE TABLE game_session (
    session_id VARCHAR(10) PRIMARY KEY, 
    host_user_id VARCHAR(10) NOT NULL,
    session_access_code VARCHAR(20) NOT NULL,
    shop_access_code VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME NULL,
    ended_at DATETIME NULL,
    round_number INT DEFAULT 1,
    max_players INT NOT NULL,

    CONSTRAINT fk_host FOREIGN KEY (host_user_id) REFERENCES users(user_id)
);

ALTER TABLE game_session 
ADD COLUMN user_id VARCHAR(10) NOT NULL AFTER session_id;

ALTER TABLE game_session 
ADD CONSTRAINT fk_real_user 
FOREIGN KEY (user_id) REFERENCES users(user_id);

CREATE TABLE players (
    player_id VARCHAR(10) PRIMARY KEY, 
    user_id VARCHAR(10) NOT NULL,
    session_id VARCHAR(10) NOT NULL,
    player_name VARCHAR(50) NOT NULL,
    current_cell VARCHAR(10) NOT NULL,
    coins INT DEFAULT 0,
    
    CONSTRAINT chk_coins CHECK (coins >= 0),
    CONSTRAINT fk_player_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_player_session FOREIGN KEY (session_id) REFERENCES game_session(session_id)
);

ALTER TABLE players ADD COLUMN img_id INT;

CREATE TABLE cells(
cell_code varchar(10) PRIMARY KEY NOT NULL UNIQUE,
    cell_type varchar(30) NOT NULL
);

CREATE TABLE treasures_map (
    treasure_id VARCHAR(10) PRIMARY KEY, 
    treasure_name VARCHAR(30) NOT NULL
);

CREATE TABLE questions (
    question_id VARCHAR(10) PRIMARY KEY, 
    level VARCHAR(10) NOT NULL, 
    question_text TEXT NOT NULL,
    explanation TEXT NOT NULL
);

CREATE TABLE question_choices (
    choice_id VARCHAR(10) PRIMARY KEY,
    question_id VARCHAR(10),
    choice_text TEXT NOT NULL,
    is_answer BOOLEAN NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(question_id)
);

CREATE TABLE session_treasures (
    session_id VARCHAR(10),
    treasure_id VARCHAR(10),
    cell_code VARCHAR(10) NOT NULL,
    is_real BOOLEAN NOT NULL,
    PRIMARY KEY (session_id, treasure_id),
    FOREIGN KEY (treasure_id) REFERENCES treasures_map(treasure_id)
);

ALTER TABLE session_treasures
ADD CONSTRAINT fk_treasure_to_special
FOREIGN KEY (session_id, cell_code) 
REFERENCES special_cell_verification(session_id, cell_code) 
ON DELETE CASCADE;

CREATE TABLE found_treasures (
    player_id VARCHAR(10),
    session_id VARCHAR(10),
    treasure_id VARCHAR(10),
    found_round INT NOT NULL,
    PRIMARY KEY (player_id, session_id, treasure_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    FOREIGN KEY (session_id, treasure_id) REFERENCES session_treasures(session_id, treasure_id)
);

CREATE TABLE player_clues (
    clue_id VARCHAR(10) PRIMARY KEY,
    player_id VARCHAR(10) NOT NULL,
    session_id VARCHAR(10) NOT NULL,
    treasure_id VARCHAR(10) NOT NULL,
    clue_text TEXT NOT NULL,
    obtained_round INT NOT NULL,
    source VARCHAR(20) NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    FOREIGN KEY (session_id, treasure_id) REFERENCES session_treasures(session_id, treasure_id)
);

CREATE TABLE special_cell_verification (
    session_id VARCHAR(10),
    cell_code VARCHAR(10),
    verify_code VARCHAR(10) NOT NULL, 
    outcome_type VARCHAR(30) NOT NULL, 
    PRIMARY KEY (session_id, cell_code),
    FOREIGN KEY (session_id) REFERENCES game_session(session_id),
    FOREIGN KEY (cell_code) REFERENCES cells(cell_code)
);

CREATE TABLE player_cards (
    player_id VARCHAR(10),
    card_type VARCHAR(30),
    card_value INT NULL,  
    quantity INT NOT NULL,
    obtained_round INT NOT NULL,
    PRIMARY KEY (player_id, card_type, obtained_round),
    FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE question_attempts (
    player_id VARCHAR(10),
    session_id VARCHAR(10),
    question_id VARCHAR(10),
    selected_choice_id VARCHAR(10),
    answered_round INT NOT NULL,
    PRIMARY KEY (player_id, session_id, question_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    FOREIGN KEY (session_id) REFERENCES game_session(session_id),
    FOREIGN KEY (question_id) REFERENCES questions(question_id),
    FOREIGN KEY (selected_choice_id) REFERENCES question_choices(choice_id)
);

-- insert data of cell
INSERT INTO cells (cell_code, cell_type) VALUES
-- Row 1-8
('C01', 'Start'),   ('C02', 'Normal'),  ('C03', 'Special'), ('C04', 'Normal'),  
('C05', 'Special'), ('C06', 'Normal'),  ('C07', 'Special'), ('C08', 'Normal'),
-- Row 9-16
('C09', 'Shop'),    ('C10', 'Normal'),  ('C11', 'Special'), ('C12', 'Special'), 
('C13', 'Special'), ('C14', 'Normal'),  ('C15', 'Special'), ('C16', 'Normal'),
-- Row 17-24
('C17', 'Special'), ('C18', 'Normal'),  ('C19', 'Special'), ('C20', 'Normal'),  
('C21', 'Special'), ('C22', 'Normal'),  ('C23', 'Shop'),    ('C24', 'Normal'),
-- Row 25-32
('C25', 'Start'),   ('C26', 'Normal'),  ('C27', 'Special'), ('C28', 'Normal'),  
('C29', 'Special'), ('C30', 'Normal'),  ('C31', 'Special'), ('C32', 'Normal'),
-- Row 33-40
('C33', 'Special'), ('C34', 'Normal'),  ('C35', 'Special'), ('C36', 'Normal'),  
('C37', 'Special'), ('C38', 'Normal'),  ('C39', 'Shop'),    ('C40', 'Normal'),
-- Row 41-48
('C41', 'Special'), ('C42', 'Normal'),  ('C43', 'Special'), ('C44', 'Normal'),  
('C45', 'Special'), ('C46', 'Normal'),  ('C47', 'Special'), ('C48', 'Normal'),
-- Row 49-56 
('C49', 'Start'),   ('C50', 'Normal'),  ('C51', 'Special'), ('C52', 'Normal'),  
('C53', 'Shop'),    ('C54', 'Normal'),  ('C55', 'Special'), ('C56', 'Normal'),
-- Row 57-64
('C57', 'Special'), ('C58', 'Normal'),  ('C59', 'Special'), ('C60', 'Normal'),  
('C61', 'Special'), ('C62', 'Normal'),  ('C63', 'Shop'),    ('C64', 'Normal'),
-- Row 65-72
('C65', 'Special'), ('C66', 'Normal'),  ('C67', 'Special'), ('C68', 'Normal'),  
('C69', 'Special'), ('C70', 'Normal'),  ('C71', 'Normal'),  ('C72', 'Normal');


-- insert the trasure
INSERT INTO treasures_map (treasure_id, treasure_name) VALUES
('T0001', 'The Kings Seal Ring'),
('T0002', 'Crusaders Shield'),
('T0003', 'Alchemists Grimoire'),
('T0004', 'Golden Chalice'),
('T0005', 'Dragon-Engraved Dagger'),
('T0006', 'Pouch of Gold Florins'),
('T0007', 'The Iron Crown'),
('T0008', 'Bishops Medallion'),
('T0009', 'Sealed Land Deed'),
('T0010', 'Jeweled Candelabra');


INSERT INTO questions (question_id, level, question_text, explanation) VALUES
('Q001', 'Easy', 'Which keyword is used to start a conditional statement?', 'The "if" keyword evaluates a boolean expression to determine if a block of code should run.'),
('Q002', 'Easy', 'Which loop is specifically designed to iterate over a sequence (list, string, range)?', 'A "for" loop is used for iterating over a sequence.'),
('Q003', 'Easy', 'What is the default step value in the range(5) function?', 'By default, range() increments by 1 if the third argument is not provided.'),
('Q004', 'Easy', 'Which keyword provides a "fallback" block if the "if" condition is False?', 'The "else" block executes only when all previous if/elif conditions are False.'),
('Q005', 'Easy', 'How do you check another specific condition if the first "if" is False?', '"elif" is short for "else if" and allows for multiple conditional checks.'),
('Q006', 'Easy', 'What character must follow the condition in an "if" or "while" header?', 'All control flow headers in Python must end with a colon (:).'),
('Q007', 'Easy', 'Which loop continues to run as long as a certain condition remains True?', 'A "while" loop checks its condition before every iteration.'),
('Q008', 'Easy', 'Which of these correctly creates an infinite loop?', '"while True:" creates a loop where the condition is always True.'),
('Q009', 'Easy', 'Which keyword acts as a placeholder for code that is not yet written?', 'The "pass" statement is a null operation; nothing happens when it executes.'),
('Q010', 'Easy', 'What is the boolean value of an empty string ""?', 'Empty strings are "Falsy" and evaluate to False in a boolean context.'),
('Q011', 'Easy', 'What integers are produced by range(0, 3)?', 'Range stops before the end value, so it produces 0, 1, and 2.'),
('Q012', 'Easy', 'Which operator is used to compare if two values are equal?', '"==" is the comparison operator; "=" is for variable assignment.'),
('Q013', 'Easy', 'How does Python determine which lines of code belong to a specific "if" block?', 'Python uses indentation (whitespace) to define the scope of code blocks.'),
('Q014', 'Easy', 'What is the output of: if True: print("Hello")?', 'It prints "Hello" because the condition is explicitly True.'),
('Q015', 'Easy', 'Which keyword skips the current iteration and jumps to the next one?', '"continue" stops the current loop body and starts the next loop cycle.'),
('Q016', 'Easy', 'Which keyword is used to exit a loop entirely?', '"break" terminates the loop immediately regardless of the condition.'),
('Q017', 'Easy', 'What is the result of the expression: not True?', 'The "not" operator returns the opposite boolean value.'),
('Q018', 'Easy', 'Is it possible to use a "for" loop to iterate over each letter in a string?', 'Yes, strings are iterable sequences in Python.'),
('Q019', 'Easy', 'What is the starting value of range(3, 6)?', 'The first argument in range() is the inclusive starting point.'),
('Q020', 'Easy', 'What is the output of: if 5 > 10: print("A") else: print("B")?', 'Since 5 is not greater than 10, the else block executes printing "B".'),

('Q021', 'Middle', 'What is the output of range(2, 10, 2)?', 'It starts at 2 and increments by 2 until it reaches but does not include 10.'),
('Q022', 'Middle', 'What is the result of the expression: 10 > 5 and 5 > 10?', 'The "and" operator requires both sides to be True to return True.'),
('Q023', 'Middle', 'What is "short-circuiting" in a Python "or" statement?', 'If the first condition is True, Python skips evaluating the second because the result is already known.'),
('Q024', 'Middle', 'What is the output of: for i in range(1): print(i)?', 'The loop runs once for the value 0.'),
('Q025', 'Middle', 'What happens if a "while" condition is False the very first time it is checked?', 'The loop body is skipped entirely.'),
('Q026', 'Middle', 'What is the output: if [0]: print("True")?', 'A list containing 0 is not empty, and non-empty sequences are Truthy.'),
('Q027', 'Middle', 'How can you access both the index and the item during a for loop?', 'The enumerate() function wraps an iterable and returns pairs of index and value.'),
('Q028', 'Middle', 'What is the result of: print(not(5 == 5))?', '5 == 5 is True, and "not True" results in False.'),
('Q029', 'Middle', 'Which keywords were introduced in Python 3.10 for Structural Pattern Matching?', 'Match and Case allow for complex conditional branching similar to switch statements.'),
('Q030', 'Middle', 'What does range(5, 0, -1) produce?', 'It starts at 5 and decrements by 1 until it reaches but does not include 0.'),
('Q031', 'Middle', 'What is a nested loop?', 'A nested loop is a loop located inside the code block of another loop.'),
('Q032', 'Middle', 'In nested loops, which loop runs its full cycle of iterations for every single step of the other?', 'The inner loop must complete all its cycles before the outer loop moves to its next step.'),
('Q033', 'Middle', 'What is the boolean value of the float 0.0?', 'Numeric zero of any type (0, 0.0, 0j) is considered False.'),
('Q034', 'Middle', 'What is the result of comparing "apple" < "banana"?', 'Strings are compared lexicographically (alphabetical order); "a" comes before "b".'),
('Q035', 'Middle', 'Can you use an "else" statement with a "while" loop?', 'Yes, the else block executes when the while condition becomes False.'),
('Q036', 'Middle', 'When does a loop "else" block NOT execute?', 'If the loop is exited via a "break" statement, the else block is skipped.'),
('Q037', 'Middle', 'What is the output of: print("x" in "box")?', 'The "in" operator returns True if the substring is found in the string.'),
('Q038', 'Middle', 'What is the output of: print(10 != 10)?', '10 is equal to 10, so the "not equal" check returns False.'),
('Q039', 'Middle', 'What is the purpose of the ":=" (Walrus) operator?', 'It allows you to assign a value to a variable as part of a larger expression.'),
('Q040', 'Middle', 'What is the output: if None: print("A") else: print("B")?', 'None is Falsy, so the code moves to the else block.'),
('Q041', 'Middle', 'What is the result of range(10)[:2]?', 'Slicing a range returns a new range representing the first two values (0, 1).'),
('Q042', 'Middle', 'Does "continue" prevent a loop "else" block from running?', 'No, the else block only cares if the loop was terminated by "break".'),
('Q043', 'Middle', 'What is the output: for i in "AB": print(i, end="")?', 'It iterates through the string characters, printing "AB".'),
('Q044', 'Middle', 'How many times does "while 1 < 0:" execute its body?', 'Zero times, as 1 is never less than 0.'),
('Q045', 'Middle', 'Which operator has higher precedence: "and" or "or"?', 'Python evaluates "and" before "or" unless parentheses are used.'),
('Q046', 'Middle', 'Result of: True or False and False?', 'Python evaluates the "and" first (False), then the "or" (True).'),
('Q047', 'Middle', 'What is bool("False")?', 'Even though the word is "False", it is a non-empty string, which is Truthy.'),
('Q048', 'Middle', 'What does a for loop iterate over when used on a Dictionary?', 'By default, iterating over a dictionary loops through its keys.'),
('Q049', 'Middle', 'How do you break out of only the innermost loop in a nested structure?', 'A "break" only affects the specific loop it is currently inside.'),
('Q050', 'Middle', 'What happens in: for i in range(5, 5):?', 'The loop never runs because the start and stop values are the same.'),

('Q051', 'Challenge', 'Output: print(all([True, 1, "text"]))?', 'The all() function returns True if all elements in the iterable are Truthy.'),
('Q052', 'Challenge', 'Output: print(any([0, "", None, False]))?', 'any() returns False if every single element in the iterable is Falsy.'),
('Q053', 'Challenge', 'What is the result of 1 < 2 < 3?', 'Python supports chained comparisons; this checks if 1 < 2 AND 2 < 3.'),
('Q054', 'Challenge', 'What is the result of 5 > 2 < 10?', 'This checks if 5 > 2 AND 2 < 10, which is True.'),
('Q055', 'Challenge', 'What is the value of i after: for i in range(3): pass?', 'The loop variable i persists after the loop with its last assigned value, 2.'),
('Q056', 'Challenge', 'What is the risk of removing items from a list while looping over it?', 'It often results in skipping items because the internal index shifts.'),
('Q057', 'Challenge', 'Output: [x for x in range(3) if x > 1]?', 'This is a list comprehension that filters values greater than 1.'),
('Q058', 'Challenge', 'What is the Python equivalent of the ternary operator (a ? b : c)?', 'Python uses the syntax: "ValueIfTrue if condition else ValueIfFalse".'),
('Q059', 'Challenge', 'What is the output of: print(1 == True)?', 'In Python, True is numerically equal to 1.'),
('Q060', 'Challenge', 'What is the output of: print(1 is True)?', '"is" checks if two variables point to the same object in memory, not just value.'),
('Q061', 'Challenge', 'In match-case, what does the "_" case represent?', 'The underscore serves as a wildcard/default case that matches anything.'),
('Q062', 'Challenge', 'What is the result of bool(range(0))?', 'An empty range has no elements, making it Falsy.'),
('Q063', 'Challenge', 'Output: for i in range(3): break else: print("X")?', 'The break prevents the loop from finishing "naturally," so else is skipped.'),
('Q064', 'Challenge', 'How to check if x is between 5 and 15 (inclusive)?', 'Python allows the mathematical notation 5 <= x <= 15.'),
('Q065', 'Challenge', 'What is the result of bool(lambda x: x)?', 'Function objects (including lambdas) are considered Truthy.'),
('Q066', 'Challenge', 'How do you match multiple values in a single match case?', 'The pipe symbol "|" is used as an "OR" operator in patterns.'),
('Q067', 'Challenge', 'What is the output of: if -5: print("Yes")?', 'Any non-zero integer (even negative) is considered Truthy.'),
('Q068', 'Challenge', 'What is "iterable unpacking" in a for loop?', 'Directly assigning multiple values from a nested structure (e.g., for x, y in points).'),
('Q069', 'Challenge', 'Can a "try" statement have an "else" block?', 'Yes, it executes if the code in the try block did not raise an exception.'),
('Q070', 'Challenge', 'What is the default recursion limit in Python?', 'Standard Python usually limits recursion to 1000 calls to prevent stack overflow.'),
('Q071', 'Challenge', 'Output: x=10; print(x > 5 > 2)?', 'This checks 10 > 5 and 5 > 2, which is True.'),
('Q072', 'Challenge', 'Output: x=10; print(x > 5 > 8)?', 'This checks 10 > 5 (True) but then checks 5 > 8 (False).'),
('Q073', 'Challenge', 'Does "pass" allow a loop to skip to the next iteration?', 'No, pass does nothing. "continue" is used to skip to the next iteration.'),
('Q074', 'Challenge', 'What is the result of: "name" in {"name": "Gemini"}?', 'The "in" operator checks for the presence of a key in a dictionary.'),
('Q075', 'Challenge', 'What is the result of: 5 in {1, 2, 3}?', 'The "in" operator checks for membership in a set.'),
('Q076', 'Challenge', 'Best way to write a loop that waits forever?', 'A while True loop with a pass statement is common for busy-waiting.'),
('Q077', 'Challenge', 'Can "break" be used inside a list comprehension?', 'No, list comprehensions are expressions and cannot contain control flow statements like break.'),
('Q078', 'Challenge', 'What is the result of: not not "Text"?', 'Double negation converts a Truthy value to True.'),
('Q079', 'Challenge', 'Output: print(10 or 20)?', 'The "or" operator returns the first Truthy value it finds.'),
('Q080', 'Challenge', 'Output: print(0 or 30)?', 'Since 0 is Falsy, it evaluates and returns the second value, 30.');


INSERT INTO question_choices (choice_id, question_id, choice_text, is_answer) VALUES
-- EASY (Q001 - Q020)
('C001', 'Q001', 'A. if', TRUE), ('C002', 'Q001', 'B. when', FALSE), ('C003', 'Q001', 'C. while', FALSE), ('C004', 'Q001', 'D. for', FALSE),
('C005', 'Q002', 'A. while', FALSE), ('C006', 'Q002', 'B. for', TRUE), ('C007', 'Q002', 'C. do-while', FALSE), ('C008', 'Q002', 'D. switch', FALSE),
('C009', 'Q003', 'A. 0', FALSE), ('C010', 'Q003', 'B. 1', TRUE), ('C011', 'Q003', 'C. 2', FALSE), ('C012', 'Q003', 'D. 5', FALSE),
('C013', 'Q004', 'A. elif', FALSE), ('C014', 'Q004', 'B. else', TRUE), ('C015', 'Q004', 'C. except', FALSE), ('C016', 'Q004', 'D. finally', FALSE),
('C017', 'Q005', 'A. else if', FALSE), ('C018', 'Q005', 'B. elseif', FALSE), ('C019', 'Q005', 'C. elif', TRUE), ('C020', 'Q005', 'D. if else', FALSE),
('C021', 'Q006', 'A. ;', FALSE), ('C022', 'Q006', 'B. {', FALSE), ('C023', 'Q006', 'C. :', TRUE), ('C024', 'Q006', 'D. /', FALSE),
('C025', 'Q007', 'A. for', FALSE), ('C026', 'Q007', 'B. while', TRUE), ('C027', 'Q007', 'C. if', FALSE), ('C028', 'Q007', 'D. break', FALSE),
('C029', 'Q008', 'A. while True:', TRUE), ('C030', 'Q008', 'B. for i in range(0):', FALSE), ('C031', 'Q008', 'C. if 1 == 1:', FALSE), ('C032', 'Q008', 'D. while 0:', FALSE),
('C033', 'Q009', 'A. null', FALSE), ('C034', 'Q009', 'B. continue', FALSE), ('C035', 'Q009', 'C. pass', TRUE), ('C036', 'Q009', 'D. skip', FALSE),
('C037', 'Q010', 'A. True', FALSE), ('C038', 'Q010', 'B. False', TRUE), ('C039', 'Q010', 'C. None', FALSE), ('C040', 'Q010', 'D. Error', FALSE),
('C041', 'Q011', 'A. 0, 1, 2, 3', FALSE), ('C042', 'Q011', 'B. 1, 2, 3', FALSE), ('C043', 'Q011', 'C. 0, 1, 2', TRUE), ('C044', 'Q011', 'D. 1, 2', FALSE),
('C045', 'Q012', 'A. =', FALSE), ('C046', 'Q012', 'B. ==', TRUE), ('C047', 'Q012', 'C. ===', FALSE), ('C048', 'Q012', 'D. is', FALSE),
('C049', 'Q013', 'A. Brackets', FALSE), ('C050', 'Q013', 'B. Semicolons', FALSE), ('C051', 'Q013', 'C. Indentation', TRUE), ('C052', 'Q013', 'D. Quotes', FALSE),
('C053', 'Q014', 'A. Hello', TRUE), ('C054', 'Q014', 'B. True', FALSE), ('C055', 'Q014', 'C. Nothing', FALSE), ('C056', 'Q014', 'D. Error', FALSE),
('C057', 'Q015', 'A. break', FALSE), ('C058', 'Q015', 'B. continue', TRUE), ('C059', 'Q015', 'C. exit', FALSE), ('C060', 'Q015', 'D. next', FALSE),
('C061', 'Q016', 'A. break', TRUE), ('C062', 'Q016', 'B. continue', FALSE), ('C063', 'Q016', 'C. stop', FALSE), ('C064', 'Q016', 'D. return', FALSE),
('C065', 'Q017', 'A. True', FALSE), ('C066', 'Q017', 'B. False', TRUE), ('C067', 'Q017', 'C. 0', FALSE), ('C068', 'Q017', 'D. None', FALSE),
('C069', 'Q018', 'A. Yes', TRUE), ('C070', 'Q018', 'B. No', FALSE), ('C071', 'Q018', 'C. Only if it is a list', FALSE), ('C072', 'Q018', 'D. Only in Python 2', FALSE),
('C073', 'Q019', 'A. 0', FALSE), ('C074', 'Q019', 'B. 3', TRUE), ('C075', 'Q019', 'C. 6', FALSE), ('C076', 'Q019', 'D. 1', FALSE),
('C077', 'Q020', 'A. A', FALSE), ('C078', 'Q020', 'B. B', TRUE), ('C079', 'Q020', 'C. 5', FALSE), ('C080', 'Q020', 'D. Error', FALSE),

-- MIDDLE (Q021 - Q050)
('C081', 'Q021', 'A. 2, 4, 6, 8', TRUE), ('C082', 'Q021', 'B. 2, 4, 6, 8, 10', FALSE), ('C083', 'Q021', 'C. 2, 3, 4, 5', FALSE), ('C084', 'Q021', 'D. 0, 2, 4, 6, 8', FALSE),
('C085', 'Q022', 'A. True', FALSE), ('C086', 'Q022', 'B. False', TRUE), ('C087', 'Q022', 'C. 10', FALSE), ('C088', 'Q022', 'D. None', FALSE),
('C089', 'Q023', 'A. Error handling', FALSE), ('C090', 'Q023', 'B. Skipping second part if first is True', TRUE), ('C091', 'Q023', 'C. Repeating a loop', FALSE), ('C092', 'Q023', 'D. Closing a file', FALSE),
('C093', 'Q024', 'A. 0', TRUE), ('C094', 'Q024', 'B. 1', FALSE), ('C095', 'Q024', 'C. 0, 1', FALSE), ('C096', 'Q024', 'D. Nothing', FALSE),
('C097', 'Q025', 'A. Loop runs once', FALSE), ('C098', 'Q025', 'B. Loop is skipped', TRUE), ('C099', 'Q025', 'C. Error occurs', FALSE), ('C100', 'Q025', 'D. Infinite loop', FALSE),
('C101', 'Q026', 'A. True', TRUE), ('C102', 'Q026', 'B. False', FALSE), ('C103', 'Q026', 'C. Hi', FALSE), ('C104', 'Q026', 'D. 0', FALSE),
('C105', 'Q027', 'A. range()', FALSE), ('C106', 'Q027', 'B. enumerate()', TRUE), ('C107', 'Q027', 'C. zip()', FALSE), ('C108', 'Q027', 'D. count()', FALSE),
('C109', 'Q028', 'A. True', FALSE), ('C110', 'Q028', 'B. False', TRUE), ('C111', 'Q028', 'C. 5', FALSE), ('C112', 'Q028', 'D. 0', FALSE),
('C113', 'Q029', 'A. switch/case', FALSE), ('C114', 'Q029', 'B. match/case', TRUE), ('C115', 'Q029', 'C. try/except', FALSE), ('C116', 'Q029', 'D. select/when', FALSE),
('C117', 'Q030', 'A. 5, 4, 3, 2, 1, 0', FALSE), ('C118', 'Q030', 'B. 5, 4, 3, 2, 1', TRUE), ('C119', 'Q030', 'C. 4, 3, 2, 1, 0', FALSE), ('C120', 'Q030', 'D. 0, 1, 2, 3, 4, 5', FALSE),
('C121', 'Q031', 'A. A loop with 1000 lines', FALSE), ('C122', 'Q031', 'B. A loop inside another loop', TRUE), ('C123', 'Q031', 'C. A loop that never ends', FALSE), ('C124', 'Q031', 'D. A loop that skips odd numbers', FALSE),
('C125', 'Q032', 'A. Outer loop', FALSE), ('C126', 'Q032', 'B. Inner loop', TRUE), ('C127', 'Q032', 'C. Both together', FALSE), ('C128', 'Q032', 'D. Neither', FALSE),
('C129', 'Q033', 'A. True', FALSE), ('C130', 'Q033', 'B. False', TRUE), ('C131', 'Q033', 'C. 0.0', FALSE), ('C132', 'Q033', 'D. None', FALSE),
('C133', 'Q034', 'A. True', TRUE), ('C134', 'Q034', 'B. False', FALSE), ('C135', 'Q034', 'C. apple', FALSE), ('C136', 'Q034', 'D. banana', FALSE),
('C137', 'Q035', 'A. Yes', TRUE), ('C138', 'Q035', 'B. No', FALSE), ('C139', 'Q035', 'C. Only in Python 2', FALSE), ('C140', 'Q035', 'D. Only if it is a list', FALSE),
('C141', 'Q036', 'A. When the loop ends normally', FALSE), ('C142', 'Q036', 'B. When the loop hits a "break"', TRUE), ('C143', 'Q036', 'C. When the loop is empty', FALSE), ('C144', 'Q036', 'D. When it hits "continue"', FALSE),
('C145', 'Q037', 'A. True', TRUE), ('C146', 'Q037', 'B. False', FALSE), ('C147', 'Q037', 'C. x', FALSE), ('C148', 'Q037', 'D. box', FALSE),
('C149', 'Q038', 'A. True', FALSE), ('C150', 'Q038', 'B. False', TRUE), ('C151', 'Q038', 'C. 10', FALSE), ('C152', 'Q038', 'D. 0', FALSE),
('C153', 'Q039', 'A. Assignment in expression', TRUE), ('C154', 'Q039', 'B. Printing data', FALSE), ('C155', 'Q039', 'C. Comparing strings', FALSE), ('C156', 'Q039', 'D. Breaking loops', FALSE),
('C157', 'Q040', 'A. A', FALSE), ('C158', 'Q040', 'B. B', TRUE), ('C159', 'Q040', 'C. None', FALSE), ('C160', 'Q040', 'D. Error', FALSE),
('C161', 'Q041', 'A. 0, 1', TRUE), ('C162', 'Q041', 'B. 0, 1, 2', FALSE), ('C163', 'Q041', 'C. 1, 2', FALSE), ('C164', 'Q041', 'D. 9, 10', FALSE),
('C165', 'Q042', 'A. Yes', FALSE), ('C166', 'Q042', 'B. No', TRUE), ('C167', 'Q042', 'C. Only if it is the last item', FALSE), ('C168', 'Q042', 'D. Only in while loops', FALSE),
('C169', 'Q043', 'A. AB', TRUE), ('C170', 'Q043', 'B. A B', FALSE), ('C171', 'Q043', 'C. A, B', FALSE), ('C172', 'Q043', 'D. B', FALSE),
('C173', 'Q044', 'A. 0', TRUE), ('C174', 'Q044', 'B. 1', FALSE), ('C175', 'Q044', 'C. Infinite', FALSE), ('C176', 'Q044', 'D. Error', FALSE),
('C177', 'Q045', 'A. and', TRUE), ('C178', 'Q045', 'B. or', FALSE), ('C179', 'Q045', 'C. They are equal', FALSE), ('C180', 'Q045', 'D. Not defined', FALSE),
('C181', 'Q046', 'A. True', TRUE), ('C182', 'Q046', 'B. False', FALSE), ('C183', 'Q046', 'C. None', FALSE), ('C184', 'Q046', 'D. Error', FALSE),
('C185', 'Q047', 'A. True', TRUE), ('C186', 'Q047', 'B. False', FALSE), ('C187', 'Q047', 'C. None', FALSE), ('C188', 'Q047', 'D. Error', FALSE),
('C189', 'Q048', 'A. Keys', TRUE), ('C190', 'Q048', 'B. Values', FALSE), ('C191', 'Q048', 'C. Both', FALSE), ('C192', 'Q048', 'D. Error', FALSE),
('C193', 'Q049', 'A. break', TRUE), ('C194', 'Q049', 'B. continue', FALSE), ('C195', 'Q049', 'C. pass', FALSE), ('C196', 'Q049', 'D. return', FALSE),
('C197', 'Q050', 'A. Runs 5 times', FALSE), ('C198', 'Q050', 'B. Never runs', TRUE), ('C199', 'Q050', 'C. Runs once', FALSE), ('C200', 'Q050', 'D. Error', FALSE),

-- CHALLENGE (Q051 - Q080)
('C201', 'Q051', 'A. True', TRUE), ('C202', 'Q051', 'B. False', FALSE), ('C203', 'Q051', 'C. None', FALSE), ('C204', 'Q051', 'D. Error', FALSE),
('C205', 'Q052', 'A. True', FALSE), ('C206', 'Q052', 'B. False', TRUE), ('C207', 'Q052', 'C. None', FALSE), ('C208', 'Q052', 'D. Error', FALSE),
('C209', 'Q053', 'A. True', TRUE), ('C210', 'Q053', 'B. False', FALSE), ('C211', 'Q053', 'C. 1', FALSE), ('C212', 'Q053', 'D. 3', FALSE),
('C213', 'Q054', 'A. True', TRUE), ('C214', 'Q054', 'B. False', FALSE), ('C215', 'Q054', 'C. 5', FALSE), ('C216', 'Q054', 'D. 10', FALSE),
('C217', 'Q055', 'A. 0', FALSE), ('C218', 'Q055', 'B. 2', TRUE), ('C219', 'Q055', 'C. 3', FALSE), ('C220', 'Q055', 'D. None', FALSE),
('C221', 'Q056', 'A. Skips elements', TRUE), ('C222', 'Q056', 'B. List gets sorted', FALSE), ('C223', 'Q056', 'C. Memory crash', FALSE), ('C224', 'Q056', 'D. Nothing happens', FALSE),
('C225', 'Q057', 'A. [2]', TRUE), ('C226', 'Q057', 'B. [1, 2]', FALSE), ('C227', 'Q057', 'C. [0, 1, 2]', FALSE), ('C228', 'Q057', 'D. []', FALSE),
('C229', 'Q058', 'A. x if C else y', TRUE), ('C230', 'Q058', 'B. C ? x : y', FALSE), ('C231', 'Q058', 'C. if C then x', FALSE), ('C232', 'Q058', 'D. x or y', FALSE),
('C233', 'Q059', 'A. True', TRUE), ('C234', 'Q059', 'B. False', FALSE), ('C235', 'Q059', 'C. 1', FALSE), ('C236', 'Q059', 'D. Error', FALSE),
('C237', 'Q060', 'A. True', FALSE), ('C238', 'Q060', 'B. False', TRUE), ('C239', 'Q060', 'C. Error', FALSE), ('C240', 'Q060', 'D. None', FALSE),
('C241', 'Q061', 'A. _', TRUE), ('C242', 'Q061', 'B. *', FALSE), ('C243', 'Q061', 'C. default', FALSE), ('C244', 'Q061', 'D. else', FALSE),
('C245', 'Q062', 'A. True', FALSE), ('C246', 'Q062', 'B. False', TRUE), ('C247', 'Q062', 'C. 0', FALSE), ('C248', 'Q062', 'D. None', FALSE),
('C249', 'Q063', 'A. X', FALSE), ('C250', 'Q063', 'B. Nothing', TRUE), ('C251', 'Q063', 'C. Error', FALSE), ('C252', 'Q063', 'D. 0', FALSE),
('C253', 'Q064', 'A. 5 <= x <= 15', TRUE), ('C254', 'Q064', 'B. 5 < x < 15', FALSE), ('C255', 'Q064', 'C. 5..15', FALSE), ('C256', 'Q064', 'D. x in 5..15', FALSE),
('C257', 'Q065', 'A. True', TRUE), ('C258', 'Q065', 'B. False', FALSE), ('C259', 'Q065', 'C. None', FALSE), ('C260', 'Q065', 'D. Error', FALSE),
('C261', 'Q066', 'A. |', TRUE), ('C262', 'Q066', 'B. &', FALSE), ('C263', 'Q066', 'C. or', FALSE), ('C264', 'Q066', 'D. ,', FALSE),
('C265', 'Q067', 'A. Yes', TRUE), ('C266', 'Q067', 'B. No', FALSE), ('C267', 'Q067', 'C. -5', FALSE), ('C268', 'Q067', 'D. Error', FALSE),
('C269', 'Q068', 'A. for x, y in iterable', TRUE), ('C270', 'Q068', 'B. for x in y', FALSE), ('C271', 'Q068', 'C. x = next(y)', FALSE), ('C272', 'Q068', 'D. y = list(x)', FALSE),
('C273', 'Q069', 'A. Yes', TRUE), ('C274', 'Q069', 'B. No', FALSE), ('C275', 'Q069', 'C. Only in Python 2', FALSE), ('C276', 'Q069', 'D. Only if it is a list', FALSE),
('C277', 'Q070', 'A. 100', FALSE), ('C278', 'Q070', 'B. 1000', TRUE), ('C279', 'Q070', 'C. 10000', FALSE), ('C280', 'Q070', 'D. Unlimited', FALSE),
('C281', 'Q071', 'A. True', TRUE), ('C282', 'Q071', 'B. False', FALSE), ('C283', 'Q071', 'C. 10', FALSE), ('C284', 'Q071', 'D. 5', FALSE),
('C285', 'Q072', 'A. True', FALSE), ('C286', 'Q072', 'B. False', TRUE), ('C287', 'Q072', 'C. 10', FALSE), ('C288', 'Q072', 'D. 8', FALSE),
('C289', 'Q073', 'A. Yes', FALSE), ('C290', 'Q073', 'B. No', TRUE), ('C291', 'Q073', 'C. Only in while loops', FALSE), ('C292', 'Q073', 'D. Only in Python 2', FALSE),
('C293', 'Q074', 'A. True', TRUE), ('C294', 'Q074', 'B. False', FALSE), ('C295', 'Q074', 'C. Gemini', FALSE), ('C296', 'Q074', 'D. name', FALSE),
('C297', 'Q075', 'A. True', FALSE), ('C298', 'Q075', 'B. False', TRUE), ('C299', 'Q075', 'C. 5', FALSE), ('C300', 'Q075', 'D. 1', FALSE),
('C301', 'Q076', 'A. while True: pass', TRUE), ('C302', 'Q076', 'B. for x in range(inf):', FALSE), ('C303', 'Q076', 'C. while 1: exit()', FALSE), ('C304', 'Q076', 'D. repeat forever', FALSE),
('C305', 'Q077', 'A. Yes', FALSE), ('C306', 'Q077', 'B. No', TRUE), ('C307', 'Q077', 'C. Only if it is a list', FALSE), ('C308', 'Q077', 'D. Only in Python 2', FALSE),
('C309', 'Q078', 'A. True', TRUE), ('C310', 'Q078', 'B. False', FALSE), ('C311', 'Q078', 'C. Text', FALSE), ('C312', 'Q078', 'D. None', FALSE),
('C313', 'Q079', 'A. 10', TRUE), ('C314', 'Q079', 'B. 20', FALSE), ('C315', 'Q079', 'C. True', FALSE), ('C316', 'Q079', 'D. 30', FALSE),
('C320', 'Q080', 'A. 0', FALSE), ('C321', 'Q080', 'B. 30', TRUE), ('C322', 'Q080', 'C. True', FALSE), ('C323', 'Q080', 'D. None', FALSE);