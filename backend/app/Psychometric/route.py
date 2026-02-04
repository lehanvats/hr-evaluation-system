from flask import request, jsonify
from app.extensions import db
from app.models import PsychometricQuestion, PsychometricTestConfig, PsychometricResult, CandidateAuth
from . import psychometric_bp
from datetime import datetime
import json
import random

# Trait type mapping
TRAIT_NAMES = {
    1: "Extraversion",
    2: "Agreeableness", 
    3: "Conscientiousness",
    4: "Emotional Stability",
    5: "Intellect/Imagination"
}

#====================== Admin/Recruiter Routes ============================

@psychometric_bp.route('/load-questions', methods=['POST'])
def load_questions():
    """Load all 50 IPIP Big Five questions into database (one-time setup)"""
    try:
        # Check if questions already exist
        existing_count = PsychometricQuestion.query.count()
        if existing_count > 0:
            return jsonify({
                'success': False,
                'message': f'{existing_count} questions already exist in database'
            }), 400
        
        # IPIP Big Five questions from the script
        assessment = [
            {"question":"Am the life of the party.", "type":1, "math":"+"},
            {"question":"Feel little concern for others.", "type":2, "math":"-"},
            {"question":"Am always prepared.", "type":3, "math":"+"},
            {"question":"Get stressed out easily.", "type":4, "math":"-"},
            {"question":"Have a rich vocabulary.", "type":5, "math":"+"},
            {"question":"Don't talk a lot.", "type":1, "math":"-"},
            {"question":"Am interested in people.", "type":2, "math":"+"},
            {"question":"Leave my belongings around.", "type":3, "math":"-"},
            {"question":"Am relaxed most of the time.", "type":4, "math":"+"},
            {"question":"Have difficulty understanding abstract ideas.", "type":5, "math":"-"},
            {"question":"Feel comfortable around people.", "type":1, "math":"+"},
            {"question":"Insult people.", "type":2, "math":"-"},
            {"question":"Pay attention to details.", "type":3, "math":"+"},
            {"question":"Worry about things.", "type":4, "math":"-"},
            {"question":"Have a vivid imagination.", "type":5, "math":"+"},
            {"question":"Keep in the background.", "type":1, "math":"-"},
            {"question":"Sympathize with others' feelings.", "type":2, "math":"+"},
            {"question":"Make a mess of things.", "type":3, "math":"-"},
            {"question":"Seldom feel blue.", "type":4, "math":"+"},
            {"question":"Am not interested in abstract ideas.", "type":5, "math":"-"},
            {"question":"Start conversations.", "type":1, "math":"+"},
            {"question":"Am not interested in other people's problems.", "type":2, "math":"-"},
            {"question":"Get chores done right away.", "type":3, "math":"+"},
            {"question":"Am easily disturbed.", "type":4, "math":"-"},
            {"question":"Have excellent ideas.", "type":5, "math":"+"},
            {"question":"Have little to say.", "type":1, "math":"-"},
            {"question":"Have a soft heart.", "type":2, "math":"+"},
            {"question":"Often forget to put things back in their proper place.", "type":3, "math":"-"},
            {"question":"Get upset easily.", "type":4, "math":"-"},
            {"question":"Do not have a good imagination.", "type":5, "math":"-"},
            {"question":"Talk to a lot of different people at parties.", "type":1, "math":"+"},
            {"question":"Am not really interested in others.", "type":2, "math":"-"},
            {"question":"Like order.", "type":3, "math":"+"},
            {"question":"Change my mood a lot.", "type":4, "math":"-"},
            {"question":"Am quick to understand things.", "type":5, "math":"+"},
            {"question":"Don't like to draw attention to myself.", "type":1, "math":"-"},
            {"question":"Take time out for others.", "type":2, "math":"+"},
            {"question":"Shirk my duties.", "type":3, "math":"-"},
            {"question":"Have frequent mood swings.", "type":4, "math":"-"},
            {"question":"Use difficult words.", "type":5, "math":"+"},
            {"question":"Don't mind being the center of attention.", "type":1, "math":"+"},
            {"question":"Feel others' emotions.", "type":2, "math":"+"},
            {"question":"Follow a schedule.", "type":3, "math":"+"},
            {"question":"Get irritated easily.", "type":4, "math":"-"},
            {"question":"Spend time reflecting on things.", "type":5, "math":"+"},
            {"question":"Am quiet around strangers.", "type":1, "math":"-"},
            {"question":"Make people feel at ease.", "type":2, "math":"+"},
            {"question":"Am exacting in my work.", "type":3, "math":"+"},
            {"question":"Often feel blue.", "type":4, "math":"-"},
            {"question":"Am full of ideas.", "type":5, "math":"+"}
        ]
        
        # Add all questions to database
        for idx, q in enumerate(assessment, start=1):
            question = PsychometricQuestion(
                question_id=idx,
                question=q['question'],
                trait_type=q['type'],
                scoring_direction=q['math'],
                is_active=True
            )
            db.session.add(question)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully loaded {len(assessment)} psychometric questions',
            'count': len(assessment)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@psychometric_bp.route('/questions/all', methods=['GET'])
def get_all_questions():
    """Get all psychometric questions (for recruiter to view/select)"""
    try:
        questions = PsychometricQuestion.query.order_by(PsychometricQuestion.question_id).all()
        
        # Group by trait type
        grouped = {}
        for q in questions:
            trait_name = TRAIT_NAMES.get(q.trait_type, f"Type {q.trait_type}")
            if trait_name not in grouped:
                grouped[trait_name] = []
            grouped[trait_name].append(q.to_dict())
        
        return jsonify({
            'success': True,
            'total_questions': len(questions),
            'questions': [q.to_dict() for q in questions],
            'grouped_by_trait': grouped
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@psychometric_bp.route('/config/set', methods=['POST'])
def set_test_configuration():
    """Recruiter sets psychometric test configuration"""
    try:
        data = request.get_json()
        recruiter_id = data.get('recruiter_id')
        num_questions = data.get('num_questions', 50)
        selection_mode = data.get('selection_mode', 'random')  # 'random' or 'manual'
        selected_question_ids = data.get('selected_question_ids')  # Array of IDs for manual mode
        
        if not recruiter_id:
            return jsonify({
                'success': False,
                'error': 'recruiter_id is required'
            }), 400
        
        # Validate number of questions
        if num_questions < 15:
            return jsonify({
                'success': False,
                'error': 'Minimum 15 questions are required for a valid psychometric assessment'
            }), 400
        
        if num_questions > 50:
            return jsonify({
                'success': False,
                'error': 'Maximum 50 questions allowed'
            }), 400
        
        # Validate selection mode
        if selection_mode not in ['random', 'manual']:
            return jsonify({
                'success': False,
                'error': 'selection_mode must be "random" or "manual"'
            }), 400
        
        # Validate manual selection
        if selection_mode == 'manual':
            if not selected_question_ids or len(selected_question_ids) != num_questions:
                return jsonify({
                    'success': False,
                    'error': f'Must select exactly {num_questions} questions for manual mode'
                }), 400
        
        # Deactivate previous configs for this recruiter
        PsychometricTestConfig.query.filter_by(recruiter_id=recruiter_id).update({'is_active': False})
        
        # Create new configuration
        config = PsychometricTestConfig(
            recruiter_id=recruiter_id,
            num_questions=num_questions,
            selection_mode=selection_mode,
            selected_question_ids=json.dumps(selected_question_ids) if selected_question_ids else None,
            is_active=True
        )
        
        db.session.add(config)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Test configuration saved successfully',
            'config': config.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@psychometric_bp.route('/config/current', methods=['GET'])
def get_current_configuration():
    """Get current active test configuration"""
    try:
        recruiter_id = request.args.get('recruiter_id')
        
        if not recruiter_id:
            return jsonify({
                'success': False,
                'error': 'recruiter_id is required'
            }), 400
        
        config = PsychometricTestConfig.query.filter_by(
            recruiter_id=recruiter_id,
            is_active=True
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': 'No active configuration found'
            }), 404
        
        return jsonify({
            'success': True,
            'config': config.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

#====================== Candidate Routes ============================

@psychometric_bp.route('/test/start', methods=['POST'])
def start_test():
    """Get questions for candidate to take test"""
    try:
        data = request.get_json()
        candidate_id = data.get('candidate_id')
        
        if not candidate_id:
            return jsonify({
                'success': False,
                'error': 'candidate_id is required'
            }), 400
        
        # Get active configuration (use most recent if multiple exist)
        config = PsychometricTestConfig.query.filter_by(is_active=True).order_by(
            PsychometricTestConfig.created_at.desc()
        ).first()
        
        if not config:
            # Default: use all 50 questions randomly
            all_questions = PsychometricQuestion.query.filter_by(is_active=True).all()
            selected_questions = random.sample(all_questions, min(50, len(all_questions)))
        else:
            if config.selection_mode == 'manual' and config.selected_question_ids:
                # Use manually selected questions
                question_ids = json.loads(config.selected_question_ids)
                selected_questions = PsychometricQuestion.query.filter(
                    PsychometricQuestion.question_id.in_(question_ids)
                ).all()
            else:
                # Random selection
                all_questions = PsychometricQuestion.query.filter_by(is_active=True).all()
                selected_questions = random.sample(all_questions, min(config.num_questions, len(all_questions)))
        
        # Randomize order for candidate
        random.shuffle(selected_questions)
        
        # Instructions for candidate
        instructions = """Describe yourself as you generally are now, not as you wish to be in the future.
Describe yourself as you honestly see yourself, in relation to other people you know of the same sex as you are, and roughly your same age.
So that you can describe yourself in an honest manner, your responses will be kept in absolute confidence.

Indicate for each statement which answer best fits as a description of you:
1. Very Inaccurate
2. Moderately Inaccurate
3. Neither Accurate Nor Inaccurate
4. Moderately Accurate
5. Very Accurate"""
        
        return jsonify({
            'success': True,
            'instructions': instructions,
            'total_questions': len(selected_questions),
            'questions': [q.to_dict() for q in selected_questions],
            'answer_options': [
                {'value': 1, 'label': 'Very Inaccurate'},
                {'value': 2, 'label': 'Moderately Inaccurate'},
                {'value': 3, 'label': 'Neither Accurate Nor Inaccurate'},
                {'value': 4, 'label': 'Moderately Accurate'},
                {'value': 5, 'label': 'Very Accurate'}
            ]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@psychometric_bp.route('/test/submit', methods=['POST'])
def submit_test():
    """Submit psychometric test answers and calculate Big Five scores"""
    try:
        data = request.get_json()
        candidate_id = data.get('candidate_id')
        answers = data.get('answers')  # Array of {question_id, answer (1-5)}
        
        print(f"\n📤 Psychometric test submission received")
        print(f"👤 Candidate ID: {candidate_id}")
        print(f"📝 Total answers: {len(answers) if answers else 0}")
        
        if not candidate_id or not answers:
            print(f"❌ Validation failed - candidate_id: {candidate_id}, answers: {bool(answers)}")
            return jsonify({
                'success': False,
                'error': 'candidate_id and answers are required'
            }), 400
        
        # Initialize trait scores
        trait_scores = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        trait_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        
        print(f"🔄 Calculating scores...")
        
        # Calculate scores
        for ans in answers:
            question = PsychometricQuestion.query.filter_by(question_id=ans['question_id']).first()
            if question:
                answer_value = int(ans['answer'])
                trait_type = question.trait_type
                
                # Apply scoring direction
                if question.scoring_direction == '+':
                    score = answer_value
                else:  # '-' means reverse scoring
                    score = 6 - answer_value
                
                trait_scores[trait_type] += score
                trait_counts[trait_type] += 1
        
        print(f"📊 Trait scores calculated:")
        for trait_id, score in trait_scores.items():
            print(f"   {TRAIT_NAMES[trait_id]}: {score} (from {trait_counts[trait_id]} questions)")
        
        # Check if result already exists
        existing_result = PsychometricResult.query.filter_by(student_id=candidate_id).first()
        
        if existing_result:
            # Update existing result
            existing_result.extraversion = trait_scores[1]
            existing_result.agreeableness = trait_scores[2]
            existing_result.conscientiousness = trait_scores[3]
            existing_result.emotional_stability = trait_scores[4]
            existing_result.intellect_imagination = trait_scores[5]
            existing_result.questions_answered = len(answers)
            existing_result.test_completed = True
            existing_result.answers_json = json.dumps(answers)
            existing_result.last_updated = datetime.utcnow()
            result = existing_result
        else:
            # Create new result
            result = PsychometricResult(
                student_id=candidate_id,
                extraversion=trait_scores[1],
                agreeableness=trait_scores[2],
                conscientiousness=trait_scores[3],
                emotional_stability=trait_scores[4],
                intellect_imagination=trait_scores[5],
                questions_answered=len(answers),
                test_completed=True,
                answers_json=json.dumps(answers)
            )
            db.session.add(result)
        
        # Update candidate completion status
        candidate = CandidateAuth.query.get(candidate_id)
        if candidate:
            candidate.psychometric_completed = True
            candidate.psychometric_completed_at = datetime.utcnow()
            print(f"✅ Updated candidate {candidate_id} completion status")
        
        db.session.commit()
        print(f"✅ Psychometric test completed successfully for candidate {candidate_id}\n")
        
        return jsonify({
            'success': True,
            'message': 'Psychometric test completed successfully',
            'results': {
                'extraversion': trait_scores[1],
                'agreeableness': trait_scores[2],
                'conscientiousness': trait_scores[3],
                'emotional_stability': trait_scores[4],
                'intellect_imagination': trait_scores[5]
            },
            'trait_names': TRAIT_NAMES
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error submitting psychometric test: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@psychometric_bp.route('/results/<int:candidate_id>', methods=['GET'])
def get_candidate_results(candidate_id):
    """Get psychometric test results for a candidate"""
    try:
        result = PsychometricResult.query.filter_by(student_id=candidate_id).first()
        
        if not result:
            return jsonify({
                'success': False,
                'message': 'No results found for this candidate'
            }), 404
        
        result_dict = result.to_dict()
        result_dict['trait_names'] = TRAIT_NAMES
        
        return jsonify({
            'success': True,
            'results': result_dict
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
