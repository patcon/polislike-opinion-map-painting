#!/bin/bash
# Script to check if test coverage has decreased

# Create coverage directory if it doesn't exist
mkdir -p coverage

# Check if previous coverage report exists
if [ -f "coverage/previous-coverage.json" ]; then
  # Save current coverage report
  cp coverage/coverage-summary.json coverage/current-coverage.json
  
  # Run tests with coverage
  npm run test:coverage
  
  echo "Comparing coverage reports..."
  
  # Extract overall coverage percentages
  PREV_STATEMENTS=$(jq '.total.statements.pct' coverage/previous-coverage.json)
  PREV_BRANCHES=$(jq '.total.branches.pct' coverage/previous-coverage.json)
  PREV_FUNCTIONS=$(jq '.total.functions.pct' coverage/previous-coverage.json)
  PREV_LINES=$(jq '.total.lines.pct' coverage/previous-coverage.json)
  
  CURR_STATEMENTS=$(jq '.total.statements.pct' coverage/coverage-summary.json)
  CURR_BRANCHES=$(jq '.total.branches.pct' coverage/coverage-summary.json)
  CURR_FUNCTIONS=$(jq '.total.functions.pct' coverage/coverage-summary.json)
  CURR_LINES=$(jq '.total.lines.pct' coverage/coverage-summary.json)
  
  # Print comparison
  echo "Previous coverage:"
  echo "  Statements: $PREV_STATEMENTS%"
  echo "  Branches:   $PREV_BRANCHES%"
  echo "  Functions:  $PREV_FUNCTIONS%"
  echo "  Lines:      $PREV_LINES%"
  
  echo "Current coverage:"
  echo "  Statements: $CURR_STATEMENTS%"
  echo "  Branches:   $CURR_BRANCHES%"
  echo "  Functions:  $CURR_FUNCTIONS%"
  echo "  Lines:      $CURR_LINES%"
  
  # Check if coverage decreased
  if (( $(echo "$CURR_STATEMENTS < $PREV_STATEMENTS" | bc -l) )) || \
     (( $(echo "$CURR_BRANCHES < $PREV_BRANCHES" | bc -l) )) || \
     (( $(echo "$CURR_FUNCTIONS < $PREV_FUNCTIONS" | bc -l) )) || \
     (( $(echo "$CURR_LINES < $PREV_LINES" | bc -l) )); then
    echo "❌ Test coverage has decreased!"
    exit 1
  else
    echo "✅ Test coverage maintained or improved!"
  fi
  
  # Update previous coverage report
  cp coverage/coverage-summary.json coverage/previous-coverage.json
else
  # First run - just generate coverage report
  npm run test:coverage
  
  # Save as previous for future comparisons
  cp coverage/coverage-summary.json coverage/previous-coverage.json
  
  echo "✅ Initial coverage report generated. Future runs will compare against this baseline."
fi