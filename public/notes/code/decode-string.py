class Solution:
    def decodeString(self, s: str) -> str:
        # Stack to store repetition counts.
        # Example: for "3[a]", this stack stores 3.
        number_stack = []

        # Stack to store the string built before entering a '['.
        # Example: for "abc3[d]", it stores "abc" when '[' is encountered.
        string_stack = []

        # Builds multi-digit repetition numbers.
        # Example: "12[a]" should be treated as 12, not 1 and 2 separately.
        current_number = 0

        # Stores the decoded string for the current nesting level.
        current_string = ""

        for char in s:

            # Build the complete repetition number.
            # Example:
            # current_number = 1, next digit = 2
            # current_number becomes 1 * 10 + 2 = 12
            if char.isdigit():
                current_number = current_number * 10 + int(char)

            # '[' means a new nested section is starting.
            elif char == "[":
                # Save the repetition count for this section.
                number_stack.append(current_number)

                # Save the string built before this section.
                string_stack.append(current_string)

                # Reset — we are now processing the string inside the brackets.
                current_number = 0
                current_string = ""

            # ']' means the current nested section is complete.
            elif char == "]":
                # Get the repetition count for the current section.
                repeat_count = number_stack.pop()

                # Get the string that appeared before this section.
                previous_string = string_stack.pop()

                # Repeat the current section and attach it to the outer string.
                # Example: previous="ab", current="cd", repeat=3 → "abcdcdcd"
                current_string = (
                    previous_string + current_string * repeat_count
                )

            # Normal alphabetic characters are added to the current string.
            else:
                current_string += char

        # After processing all characters, current_string is the decoded result.
        return current_string
