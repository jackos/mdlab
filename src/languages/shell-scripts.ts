export const env_before = `#!/bin/bash
if [ -f "env_changes.sh" ]; then
  source "env_changes.sh"
fi
env | sort | awk -F '=' '{if ($2 ~ / /) printf "%s=\\"%s\\"\\n", $1, $2; else print $0}' > env_before.txt
echo '!!output-start-cell'
`;

export const env_after = `
env | sort | awk -F '=' '{if ($2 ~ / /) printf "%s=\\"%s\\"\\n", $1, $2; else print $0}' > env_after.txt

comm -13 env_before.txt env_after.txt >> env_changes.sh

# Extract words from file1 and file2 and sort them
file1_words=$(grep '.*=' env_before.txt | cut -d'=' -f1 | sort)
file2_words=$(grep '.*=' env_after.txt | cut -d'=' -f1 | sort)

# Use comm to find lines unique to file2
unset_vars=$(comm -13 <(echo "$file2_words") <(echo "$file1_words") | awk '{print "unset "$0}')
echo "$unset_vars" >> env_changes.sh

sort env_changes.sh | uniq | grep . > filename.tmp && mv filename.tmp env_changes.sh
`;
