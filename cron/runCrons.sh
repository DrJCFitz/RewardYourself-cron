#!/bin/bash
aws ecs list-task-definitions --family-prefix cron
# update statuses
aws ecs run-task --cluster default --task-definition cron:4 --count 1
# pause for 10 minutes to allow status script to complete 
sleep 600
# update scrape data
aws ecs run-task --cluster default --task-definition cron:5 --count 1