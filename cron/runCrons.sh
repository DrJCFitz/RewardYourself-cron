#!/bin/bash
export AWS_DEFAULT_REGION=us-east-1
#aws ecs list-task-definitions --family-prefix cron
# update statuses
aws ecs run-task --cluster default --task-definition cron:7 --count 1
# pause for 10 minutes to allow status script to complete 
sleep 600
# update scrape data
aws ecs run-task --cluster default --task-definition cron:6 --count 1
sleep 60
# remove interim data points
aws ecs run-task --cluster default --task-definition cron:8 --count 1
